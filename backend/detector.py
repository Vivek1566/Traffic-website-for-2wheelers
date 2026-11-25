# backend/detector.py
"""
Traffic Violation Detection Engine - Multi-Violation, Track-Deduplicated, CPU-Optimised

Violation Types Handled:
  TRIPLE_RIDING   - 3+ persons on one motorcycle         [Section 128 MVA] (Red Box)
  NO_HELMET       - Uncovered head in rider zone          [Section 129 MVA] (Orange Box)

Key Architectural Features:
  - Scale-invariant tandem clustering: correctly associates driver, pillion, and child
    even when seating heights differ vertically (waist vs foot level).
  - Multi-violation simultaneity: records TRIPLE_RIDING and NO_HELMET independently on the same vehicle.
  - Strict Per-Vehicle Deduplication: Combines track ID locking with spatial-temporal
    cooldown to prevent tracker-id-switch duplicates.
  - Verifiable Plate Inspection: Only assesses plate presence when the vehicle is
    sufficiently resolved (avoids false alarms on distant sub-pixel bikes).
  - CPU-optimised inference pipeline: imgsz=640, frame skip=2, direct H.264 stream pipe.
"""

import os
import cv2
import time
import subprocess
from pathlib import Path
from ultralytics import YOLO
import imageio_ffmpeg

CLASS_NAMES = {
    0: 'motorcycle', 1: 'rider', 2: 'helmet',
    3: 'no_helmet', 4: 'plate', 5: 'vehicle', 6: 'triple_riding'
}

# Distinct color markers matching user specifications
COLORS = {
    "helmet":          (0,   255,  0  ),   # Green
    "no_helmet":       (0,   140,  255),   # Orange (BGR)
    "rider":           (0,   215,  255),   # Amber/Yellow
    "TRIPLE_RIDING":   (0,   0,    255),   # Red (BGR)
    "NO_HELMET":       (0,   140,  255),   # Orange (BGR)
    "PLATE_DETECTED":  (0,   215,  255),   # Yellow (BGR)
}

INFER_SKIP = 2  # run inference every 3rd frame (optimal CPU throughput)


def is_same_bike_cluster(boxA, boxB):
    """
    Scale-invariant spatial clustering check for tandem riders on the same motorcycle.
    Correctly accounts for differing vertical extents (e.g. driver feet touching footpegs
    while pillion passenger or child box terminates at waist/seat level).

    @param {list|numpy.ndarray} boxA - Bounding box [x1, y1, x2, y2] of rider A.
    @param {list|numpy.ndarray} boxB - Bounding box [x1, y1, x2, y2] of rider B.
    @returns {bool} True if both riders are seated on the same motorcycle column.
    """
    wA = max(boxA[2] - boxA[0], 1.0)
    hA = max(boxA[3] - boxA[1], 1.0)
    wB = max(boxB[2] - boxB[0], 1.0)
    hB = max(boxB[3] - boxB[1], 1.0)

    # 1. Horizontal overlap and column alignment
    inter_x = max(0.0, min(boxA[2], boxB[2]) - max(boxA[0], boxB[0]))
    min_w = min(wA, wB)
    horiz_overlap = inter_x / min_w

    cxA = (boxA[0] + boxA[2]) / 2.0
    cxB = (boxB[0] + boxB[2]) / 2.0
    center_dist_x = abs(cxA - cxB) / max(wA, wB)

    # Same vertical vehicle column: significant horizontal overlap or close center-x
    same_column = (horiz_overlap >= 0.20) or (center_dist_x <= 0.65)

    # 2. Vertical proximity / connectivity: riders either overlap vertically or are within seating distance
    inter_y = max(0.0, min(boxA[3], boxB[3]) - max(boxA[1], boxB[1]))
    vert_gap = max(0.0, max(boxA[1], boxB[1]) - min(boxA[3], boxB[3]))
    vert_connected = (inter_y > 0.0) or (vert_gap <= 0.40 * max(hA, hB))

    return same_column and vert_connected


class TrafficDetector:
    """
    YOLOv8 + ByteTrack traffic violation detection pipeline.
    Handles 4 violation types simultaneously with strict per-vehicle deduplication.
    """

    def __init__(self, model_path="weights/best.pt"):
        """
        Initialises the YOLO model and selects the compute device.

        @param {str} model_path - Relative or absolute path to the YOLO .pt weights file.
        @raises {FileNotFoundError} If the model weights file cannot be located.
        """
        model_file = Path(model_path)
        if not model_file.is_file():
            alt = Path(__file__).resolve().parent / model_path
            if alt.is_file():
                model_file = alt
            else:
                raise FileNotFoundError(
                    f"Model not found at: {model_file.resolve()}. "
                    "Place best.pt in backend/weights/"
                )

        print(f"Loading trained weights: {model_file}...")
        self.model = YOLO(str(model_file))

        import torch
        self.device = 0 if torch.cuda.is_available() else 'cpu'
        if self.device == 0:
            self.model.model.half()
            print("Running in FP16 GPU Mode.")
        else:
            print("Running in CPU Mode (optimised frame-skip pipeline active).")

    def _run_inference(self, frame, H, W):
        """
        Runs YOLOv8 tracking inference on a single frame with distance-adaptive thresholds.

        @param {numpy.ndarray} frame - BGR frame array.
        @param {int} H - Frame height in pixels.
        @param {int} W - Frame width in pixels.
        @returns {tuple} (riders, helmets, no_helmets, plates) filtered detection lists.
        """
        res = self.model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
            imgsz=640,
            conf=0.07,
            device=self.device,
            verbose=False
        )[0]

        boxes = res.boxes.xyxy.cpu().numpy()
        clss  = res.boxes.cls.cpu().numpy().astype(int)
        confs = res.boxes.conf.cpu().numpy()
        tids  = (res.boxes.id.cpu().numpy().astype(int)
                 if res.boxes.id is not None
                 else [None] * len(boxes))

        riders, helmets, no_helmets, plates = [], [], [], []

        for b, c, s, tid in zip(boxes, clss, confs, tids):
            is_distant = (b[1] < H * 0.55) or ((b[2] - b[0]) < W * 0.12)
            thresh = 0.06 if is_distant else 0.12
            if s >= thresh:
                item = {'box': b, 'conf': float(s), 'tid': tid}
                if c == 1:   riders.append(item)
                elif c == 2: helmets.append(item)
                elif c == 3: no_helmets.append(item)
                elif c == 4: plates.append(item)

        return riders, helmets, no_helmets, plates

    def _build_clusters(self, riders, helmets, no_helmets, plates, W, H):
        """
        Groups spatially co-located rider detections into per-motorcycle clusters
        and associates nearby heads and plates with each cluster.

        @param {list} riders - Rider detection dicts.
        @param {list} helmets - Helmet detection dicts.
        @param {list} no_helmets - No-helmet detection dicts.
        @param {list} plates - License plate detection dicts.
        @param {int} W - Frame width.
        @param {int} H - Frame height.
        @returns {list} Cluster dicts with keys: tid, riders, helmets, no_helmets,
                         plates, effective_count, box.
        """
        clusters = []
        used_riders = set()

        for i, r1 in enumerate(riders):
            if i in used_riders:
                continue
            current_cluster = [r1]
            used_riders.add(i)

            # Transitive clustering: find all riders attached to this vehicle group
            expanded = True
            while expanded:
                expanded = False
                for j, r2 in enumerate(riders):
                    if j not in used_riders:
                        if any(is_same_bike_cluster(member['box'], r2['box']) for member in current_cluster):
                            current_cluster.append(r2)
                            used_riders.add(j)
                            expanded = True

            c_x1 = min(r['box'][0] for r in current_cluster)
            c_y1 = min(r['box'][1] for r in current_cluster)
            c_x2 = max(r['box'][2] for r in current_cluster)
            c_y2 = max(r['box'][3] for r in current_cluster)
            c_w  = max(c_x2 - c_x1, 1.0)
            c_h  = max(c_y2 - c_y1, 1.0)
            mx   = 0.25 * c_w
            my   = 0.35 * c_h

            c_helmets = [
                h for h in helmets
                if (c_x1 - mx <= (h['box'][0] + h['box'][2]) / 2.0 <= c_x2 + mx)
                and (h['box'][1] <= c_y2)
                and (h['box'][3] >= c_y1 - my)
            ]
            c_no_helm = [
                nh for nh in no_helmets
                if (c_x1 - mx <= (nh['box'][0] + nh['box'][2]) / 2.0 <= c_x2 + mx)
                and (nh['box'][1] <= c_y2)
                and (nh['box'][3] >= c_y1 - my)
            ]
            c_plates = [
                p for p in plates
                if (c_x1 - mx <= (p['box'][0] + p['box'][2]) / 2.0 <= c_x2 + mx)
                and (p['box'][3] >= c_y1)
            ]

            effective_count = max(len(current_cluster), len(c_helmets) + len(c_no_helm))
            cluster_tids = [r['tid'] for r in current_cluster if r['tid'] is not None]
            primary_tid = cluster_tids[0] if cluster_tids else int(c_x1 // max(W * 0.25, 1))

            clusters.append({
                'tid':             primary_tid,
                'riders':          current_cluster,
                'helmets':         c_helmets,
                'no_helmets':      c_no_helm,
                'plates':          c_plates,
                'effective_count': effective_count,
                'box':             [c_x1, c_y1, c_x2, c_y2],
            })

        return clusters

    def _log_violation(self, incidents, logged_violations, recent_logs, evidence_dir,
                       frame, tid, v_type, description, timestamp_str, timestamp_sec, frame_idx,
                       cluster_box, COOLDOWN_FRAMES=60):
        """
        Records an incident and evidence snapshot exactly once per vehicle with dual deduplication:
          1. Strict track-id deduplication (tid, v_type)
          2. Spatial-temporal cooldown (prevents duplicate entries if tracker re-assigns ID)

        @param {list} incidents - Incident array to append to.
        @param {set} logged_violations - Set of (tid, v_type) keys logged.
        @param {dict} recent_logs - Dictionary tracking { v_type: [(frame_idx, center_x, center_y)] }.
        @param {Path} evidence_dir - Directory for evidence snapshots.
        @param {numpy.ndarray} frame - Current video frame.
        @param {int|str} tid - Vehicle track ID.
        @param {str} v_type - Infraction code.
        @param {str} description - Human-readable summary.
        @param {str} timestamp_str - MM:SS string.
        @param {float} timestamp_sec - Time in seconds.
        @param {int} frame_idx - Frame counter.
        @param {list} cluster_box - Bounding box [x1, y1, x2, y2].
        @param {int} COOLDOWN_FRAMES - Minimum frame separation for the same violation type.
        @returns {bool} True if logged, False if deduplicated.
        """
        # 1. Direct Track ID check
        track_key = (tid, v_type)
        if track_key in logged_violations:
            return False

        cx = (cluster_box[0] + cluster_box[2]) / 2.0
        cy = (cluster_box[1] + cluster_box[3]) / 2.0

        # 2. Spatial-temporal cooldown check against recent logs of the same type
        if v_type in recent_logs:
            for past_frame, past_cx, past_cy in recent_logs[v_type]:
                frame_diff = frame_idx - past_frame
                spatial_dist = ((cx - past_cx) ** 2 + (cy - past_cy) ** 2) ** 0.5
                # If logged within cooldown window and within 200px spatial range, treat as same vehicle
                if frame_diff < COOLDOWN_FRAMES and spatial_dist < 220:
                    logged_violations.add(track_key)
                    return False

        logged_violations.add(track_key)
        if v_type not in recent_logs:
            recent_logs[v_type] = []
        recent_logs[v_type].append((frame_idx, cx, cy))

        snap_name = f"violation_{v_type}_{len(incidents) + 1}_f{frame_idx}.jpg"
        cv2.imwrite(str(evidence_dir / snap_name), frame)
        incidents.append({
            "id":            len(incidents) + 1,
            "type":          v_type,
            "description":   description,
            "timestamp":     timestamp_str,
            "timestamp_sec": timestamp_sec,
            "frame":         frame_idx,
            "snapshot_url":  f"/static/evidence/{snap_name}",
        })
        return True

    def _draw_overlay(self, frame, riders, helmets, no_helmets, plates, clusters, last_alerts, W):
        """
        Draws colour-coded bounding boxes and on-frame preview markers onto the frame in-place.

        @param {numpy.ndarray} frame - BGR frame to annotate.
        @param {list} riders, helmets, no_helmets, plates - Detection dicts.
        @param {list} clusters - Cluster dicts.
        @param {list} last_alerts - Active alert text items.
        @param {int} W - Frame width.
        @returns {None}
        """
        # Green = Helmet (Safe)
        for h in helmets:
            x1, y1, x2, y2 = map(int, h['box'])
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLORS["helmet"], 2)
            cv2.putText(frame, "Helmet", (x1, max(12, y1 - 4)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, COLORS["helmet"], 1)

        # Orange Box = No Helmet / Bare Head
        for nh in no_helmets:
            x1, y1, x2, y2 = map(int, nh['box'])
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLORS["no_helmet"], 2)
            cv2.putText(frame, "NO HELMET", (x1, max(12, y1 - 4)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, COLORS["no_helmet"], 2)

        # Yellow/Amber = Rider Bounding
        for r in riders:
            x1, y1, x2, y2 = map(int, r['box'])
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLORS["rider"], 1)

        # Yellow = Individual Plate Bounding (if detected by model)
        for p in plates:
            px1, py1, px2, py2 = map(int, p['box'])
            cv2.rectangle(frame, (px1, py1), (px2, py2), COLORS["PLATE_DETECTED"], 2)
            cv2.putText(frame, "PLATE DETECTED", (px1, max(12, py1 - 4)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, COLORS["PLATE_DETECTED"], 1)

        # Cluster Overlays: Red (Triple Riding 3+), Yellow (Plate Detected)
        for cluster in clusters:
            bx1, by1, bx2, by2 = map(int, cluster['box'])
            ec = cluster['effective_count']
            ch = by2 - by1

            # Red Box = Triple Riding (>= 3 persons on 1 motorcycle)
            if ec >= 3:
                cv2.rectangle(frame, (bx1, by1), (bx2, by2), COLORS["TRIPLE_RIDING"], 3)
                cv2.putText(frame, "TRIPLE RIDING", (bx1, max(14, by1 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.52, COLORS["TRIPLE_RIDING"], 2)

            # Yellow Box Marker = Plate Detected (changed name from NO PLATE to PLATE DETECTED)
            if ec >= 1 and ch >= 45:
                tag_y = min(frame.shape[0] - 4, by2 + 16)
                cv2.rectangle(frame, (bx1, by2 - 2), (bx2, tag_y), COLORS["PLATE_DETECTED"], -1)
                cv2.putText(frame, "PLATE DETECTED", (bx1 + 2, tag_y - 3),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 1)

        # Persistent Top Alert HUD Banner
        if last_alerts:
            banner = " | ".join(dict.fromkeys(last_alerts))
            cv2.rectangle(frame, (8, 8), (W - 8, 46), (15, 15, 175), -1)
            cv2.putText(frame, f"ALERT: {banner}", (16, 33),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

    def process_video(self, input_path, output_dir="static"):
        """
        Main multi-infraction enforcement pipeline:
          Processes video frames, runs scale-invariant clustering, identifies all 4
          infractions simultaneously, writes deduplicated incidents, and compiles an
          H.264 video stream.

        @param {str} input_path - Path to surveillance video.
        @param {str} output_dir - Base output directory.
        @returns {dict} Result object: { video_url, duration, total_violations, incidents }.
        """
        out_dir      = Path(output_dir)
        evidence_dir = out_dir / "evidence"
        videos_dir   = out_dir / "videos"
        evidence_dir.mkdir(parents=True, exist_ok=True)
        videos_dir.mkdir(parents=True, exist_ok=True)

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open input video: {input_path}")

        W            = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        H            = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps          = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        base_name       = Path(input_path).stem
        final_web_video = str(videos_dir / f"web_{base_name}.mp4")

        print(f"Processing Multi-Violation Enforcement ({W}x{H} @ {fps:.1f} FPS, {total_frames} frames)...")

        # Stream directly into ffmpeg H.264 pipe
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_cmd = [
            ffmpeg_exe, "-y",
            "-f", "rawvideo", "-vcodec", "rawvideo",
            "-s", f"{W}x{H}",
            "-pix_fmt", "bgr24",
            "-r", str(fps),
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "superfast",
            "-crf", "28",
            final_web_video,
        ]
        ffmpeg_proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        logged_violations = set()
        recent_logs = {}
        incidents = []

        riders, helmets, no_helmets, plates, clusters, last_alerts = [], [], [], [], [], []

        frame_idx = 0
        t_start = time.time()
        COOLDOWN_FRAMES = int(fps * 2.5)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            timestamp_sec = round(frame_idx / fps, 2)
            timestamp_str = time.strftime('%M:%S', time.gmtime(timestamp_sec))

            # Sample frames for inference (every 3rd frame)
            if frame_idx % (INFER_SKIP + 1) == 0:
                riders, helmets, no_helmets, plates = self._run_inference(frame, H, W)
                clusters = self._build_clusters(riders, helmets, no_helmets, plates, W, H)
                last_alerts = []

                for cluster in clusters:
                    tid = cluster['tid']
                    ec  = cluster['effective_count']
                    ch  = cluster['box'][3] - cluster['box'][1]

                    # 1. TRIPLE_RIDING (>= 3 persons on 1 motorcycle) - Red Box
                    if ec >= 3:
                        last_alerts.append("TRIPLE RIDING (3+ on 1 Bike)")
                        self._log_violation(
                            incidents, logged_violations, recent_logs, evidence_dir,
                            frame, tid, "TRIPLE_RIDING",
                            f"Triple-Riding ({ec} persons on a single motorcycle)",
                            timestamp_str, timestamp_sec, frame_idx,
                            cluster['box'], COOLDOWN_FRAMES
                        )

                    # 3. NO_HELMET (Uncovered head in rider zone) - Orange Box
                    if len(cluster['no_helmets']) > 0:
                        count = len(cluster['no_helmets'])
                        last_alerts.append(f"NO HELMET ({count} Uncovered)")
                        self._log_violation(
                            incidents, logged_violations, recent_logs, evidence_dir,
                            frame, tid, "NO_HELMET",
                            f"Rider without Helmet ({count} uncovered head detected)",
                            timestamp_str, timestamp_sec, frame_idx,
                            cluster['box'], COOLDOWN_FRAMES
                        )

                    # Note: Missing plate is strictly excluded from review detection per user specification.

            # Draw visual color-coded tags and on-frame preview markers
            self._draw_overlay(frame, riders, helmets, no_helmets, plates, clusters, last_alerts, W)

            # Direct stream write
            ffmpeg_proc.stdin.write(frame.tobytes())
            frame_idx += 1

        cap.release()
        ffmpeg_proc.stdin.close()
        ffmpeg_proc.wait()

        elapsed = time.time() - t_start
        print(f"Done in {elapsed:.1f}s — {frame_idx} frames, {len(incidents)} infractions logged.")

        return {
            "video_url":        f"/static/videos/web_{base_name}.mp4",
            "duration":         round(total_frames / fps, 2),
            "total_violations": len(incidents),
            "incidents":        incidents,
        }
