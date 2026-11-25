# 🚦 Traffic Eye AI

> **AI-powered traffic surveillance and two-wheeler violation analysis workstation**

Traffic Eye AI is a full-stack traffic enforcement review platform that transforms uploaded road footage into a searchable, evidence-backed incident report. It combines YOLOv8 object detection, ByteTrack multi-object tracking, spatial rider clustering, and a modern React operations dashboard to identify and document two-wheeler violations.

[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-111827?style=for-the-badge&logo=yolo&logoColor=white)](https://docs.ultralytics.com/)

---

## 🎯 Project Overview

Traffic Eye AI is designed to assist traffic monitoring teams with structured post-processing of surveillance footage. The system accepts a video, analyzes each relevant frame, tracks motorcycles and riders, evaluates helmet and passenger conditions, generates an annotated H.264 output, captures forensic snapshots, and presents all findings in a dedicated review workstation.

The application is especially useful for demonstrating:

- AI-assisted traffic surveillance
- Two-wheeler safety enforcement workflows
- Automated evidence collection
- Video-based violation auditing
- Computer vision and full-stack system integration

## ✨ Core Capabilities

| Capability | Description |
|---|---|
| **Triple-riding detection** | Groups riders spatially and flags motorcycle clusters containing three or more people. |
| **No-helmet detection** | Detects uncovered heads within the rider zone and records them as helmet violations. |
| **Vehicle tracking** | Uses Ultralytics YOLOv8 with ByteTrack for persistent object tracking. |
| **Per-vehicle deduplication** | Prevents repeated detections of the same violation through track IDs and spatial-temporal cooldown logic. |
| **Annotated video output** | Produces a browser-ready H.264/MP4 stream with color-coded AI overlays. |
| **Evidence snapshots** | Captures timestamped JPEG frames for every unique violation incident. |
| **Incident review dashboard** | Provides search, filtering, playback controls, timeline seeking, and active incident synchronization. |
| **Electronic challan** | Generates a printable, evidence-backed traffic citation with fine and statutory section details. |
| **Audit export** | Exports the complete incident queue to CSV for reporting and external analysis. |

---

## 🖥️ Interface Highlights

### Command-Center Dashboard

A dark, traffic-enforcement-inspired React interface presents real-time processing status, summary metrics, footage duration, violation counts, and active incident information.

### Interactive Evidence Playback

- AI-annotated H.264 video player
- Raw incident timestamp synchronization
- Play, pause, rewind, forward, and variable playback speed
- Direct seeking to detected incidents
- Frame-by-frame forensic context

### Incident Investigation Queue

- Violation and text search
- Separate filters for triple riding and no-helmet incidents
- Thumbnail evidence previews
- Full-resolution snapshot lightbox
- Timestamp, frame number, and descriptive offense details

### Electronic E-Challan

Every incident can be opened as an official-style citation containing:

- Incident and citation numbers
- Violation classification
- Timestamp and source frame
- Motor Vehicles Act section
- Prescribed penalty
- Captured photographic evidence
- Print-ready and PDF-export support

---

## 🧠 Detection Pipeline

```text
Uploaded Video
      │
      ▼
FastAPI Upload Endpoint
      │
      ▼
YOLOv8 Frame Detection
      │
      ├── Motorcycle / Rider
      ├── Helmet / No-Helmet
      └── License Plate
      │
      ▼
ByteTrack Multi-Object Tracking
      │
      ▼
Scale-Invariant Rider Clustering
      │
      ▼
Violation Evaluation
      │
      ├── Triple Riding
      └── No Helmet
      │
      ▼
Track & Spatial-Temporal Deduplication
      │
      ▼
Evidence Snapshot + Annotated H.264 Video
      │
      ▼
React Incident Review Dashboard
```

### Detection Approach

The backend runs YOLO tracking inference every third frame to balance detection quality with CPU performance. It builds scale-invariant motorcycle clusters from rider detections, associates nearby helmet and no-helmet detections, and calculates an effective passenger count.

A dual deduplication strategy minimizes duplicate evidence:

1. **Track-ID deduplication** — one violation key is maintained per tracked vehicle and violation type.
2. **Spatial-temporal cooldown** — if tracker IDs switch, incidents remain grouped by location and time proximity.

## 🎨 Visual Detection Legend

| Visual | Meaning |
|---|---|
| 🔴 Red | Triple riding: three or more persons detected on one motorcycle |
| 🟠 Orange | Rider or passenger without a helmet |
| 🟡 Yellow | License plate detected or plate marker |
| 🟢 Green | Helmet detected |
| 🟡 Amber | Individual rider bounding region |

---

## 🏗️ System Architecture

```text
Traffic-website-for-2wheelers/
├── backend/
│   ├── main.py                    # FastAPI application and upload API
│   ├── detector.py                # YOLO/ByteTrack analysis engine
│   ├── weights/                   # Custom YOLO model weights
│   └── static/
│       ├── videos/                # Uploaded and annotated MP4 outputs
│       └── evidence/              # JPEG violation snapshots
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Dashboard, uploader, player, and review UI
│   │   ├── main.jsx               # React entry point
│   │   └── index.css              # Tailwind imports and cyber dashboard styles
│   ├── public/                    # Static frontend assets
│   ├── package.json               # React and Vite dependencies
│   └── vite.config.js             # Development server and API proxy configuration
├── requirements.txt               # Backend Python dependencies
└── README.md                      # Project documentation
```

### Backend

The backend is a FastAPI service that:

- Hosts video and evidence media through `StaticFiles`
- Exposes `POST /api/process-video`
- Loads the custom YOLO model at startup
- Processes uploaded footage frame by frame
- Encodes the annotated output directly through FFmpeg
- Returns incident metadata and generated media paths

### Computer Vision Engine

`backend/detector.py` contains the complete enforcement pipeline:

- Rider, helmet, no-helmet, plate, and vehicle detections
- ByteTrack tracking
- Distance-adaptive confidence thresholds
- Scale-invariant tandem rider clustering
- Triple-riding and no-helmet evaluation
- Bounding-box visualization
- Incident cooldown logic
- Evidence capture and H.264 encoding

### Frontend

The frontend is built with React, Vite, Tailwind CSS, and Lucide icons. `App.jsx` implements video upload, drag-and-drop ingestion, API communication, filtering, CSV export, evidence display, playback controls, snapshot lightboxes, and print-ready challans.

---

## 🔧 Technology Stack

### Backend

- **FastAPI** — REST API and static media serving
- **Ultralytics YOLOv8** — Two-wheeler object detection
- **ByteTrack** — Multi-object tracking
- **OpenCV** — Frame processing and evidence capture
- **PyTorch** — YOLO inference and GPU acceleration
- **FFmpeg / imageio-ffmpeg** — Browser-compatible H.264 video encoding
- **Pydantic** — API request and response modeling

### Frontend

- **React 18** — Component-based interface
- **Vite 5** — Fast development and production builds
- **Tailwind CSS 3** — Responsive traffic control UI
- **Lucide React** — Consistent professional icon system

## 📊 Repository Composition

| Language | Approximate Share |
|---|---:|
| JavaScript | 63.9% |
| Python | 32.9% |
| CSS | 1.8% |
| HTML | 1.4% |

---

## 📦 Key API Contract

### Process Video

```http
POST /api/process-video
Content-Type: multipart/form-data
```

The response contains the generated video URL, source duration, violation count, and a deduplicated incident list:

```json
{
  "video_url": "/static/videos/web_example.mp4",
  "duration": 42.5,
  "total_violations": 4,
  "incidents": [
    {
      "id": 1,
      "type": "TRIPLE_RIDING",
      "description": "Triple-Riding (3 persons on a single motorcycle)",
      "timestamp": "00:12",
      "timestamp_sec": 12.36,
      "frame": 371,
      "snapshot_url": "/static/evidence/violation_TRIPLE_RIDING_1_f371.jpg"
    }
  ]
}
```

## ⚙️ Model and Hardware Behavior

The detection engine looks for custom trained weights at:

```text
backend/weights/best.pt
```

When a compatible CUDA-enabled GPU is available, the model runs in GPU FP16 mode. Otherwise, it automatically uses CPU inference with frame skipping and an optimized detection configuration.

License plate detections are visually marked, while the current enforcement incident pipeline is specifically configured for:

- Triple riding
- No helmet

## 🔒 Responsible Use

Traffic Eye AI is intended to support trained traffic personnel and authorized review workflows. Detection confidence, duplicate suppression, fine values, statutory sections, and plate handling should be validated against local law and operational policies before real-world enforcement use.

AI-generated evidence should remain subject to human review and appropriate legal safeguards.

## 🚀 Future Enhancements

- Live CCTV stream ingestion
- Multi-camera correlation and geographic mapping
- License plate OCR and vehicle identification
- Automatic evidence case management
- Role-based operator authentication
- Cloud storage and audit logging
- Configurable region-specific fines and traffic sections
- Model performance dashboard and annotation retraining workflow

---

## 📄 License

No license has currently been added to this repository. The repository owner should add an appropriate open-source or proprietary license before redistribution or public deployment.

## 👤 Author

**Vivek1566**

- GitHub: [@Vivek1566](https://github.com/Vivek1566)
- Repository: [Traffic-website-for-2wheelers](https://github.com/Vivek1566/Traffic-website-for-2wheelers)

---

<p align="center">
  <strong>Traffic Eye AI</strong><br>
  Intelligent Vision. Safer Roads. Actionable Evidence.
</p>
