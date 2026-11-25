# 🚦 Traffic Eye AI - Smart Traffic Surveillance & Violation Detection System

An AI-powered, full-stack traffic surveillance platform designed to analyze CCTV and road video feeds in real time, track vehicles, detect safety violations (helmet non-compliance, over-speeding, triple riding), extract forensic evidence snapshots, and issue automated e-challans.

---

## 📁 Project Directory Structure

```text
TrafficWebsite/
│
├── backend/
│   ├── weights/
│   │   └── best.pt                  <-- Move your downloaded best.pt here
│   ├── static/
│   │   ├── videos/                  <-- Stores uploaded & processed MP4s
│   │   └── evidence/                <-- Stores JPEG evidence snapshots
│   ├── detector.py                  <-- AI Video Processing Pipeline (YOLOv8 + CV)
│   └── main.py                      <-- FastAPI Web Server & REST API
│
├── frontend/                        <-- React UI (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── App.jsx                  <-- Dashboard, Dual Video Player & Table
│   │   ├── main.jsx                 <-- React Entry Point
│   │   └── index.css                <-- Custom Cyber HUD Styling
│   └── package.json
│
└── requirements.txt                 <-- Python Dependencies
```

Windows `.bat` launchers are excluded from Git; use the manual launch steps below.

---

## 🚀 Quick Start Guide

### 1. Requirements Setup (Python & FFmpeg)

Ensure Python 3.10+ is installed. In terminal:

```bash
cd TrafficWebsite
pip install -r requirements.txt
```

> **FFmpeg Status:**
> FFmpeg is installed on your computer (`Gyan.FFmpeg`). The AI video pipeline in `detector.py` automatically uses it to encode all annotated surveillance videos to browser-standard H.264 (`yuv420p` + `faststart`), ensuring instant playback on Chrome, Edge, Firefox, and Safari without missing-codec errors.
> If setting up on a new Windows machine: `winget install Gyan.FFmpeg` or download from [ffmpeg.org](https://ffmpeg.org).

### 2. Frontend Dependencies (Node.js)

```bash
cd TrafficWebsite/frontend
npm install
```

### 3. Adding Your Custom Model Weights (`best.pt`)

1. Copy your trained YOLO weights file (`best.pt`) into:
   ```text
   TrafficWebsite/backend/weights/best.pt
   ```
2. The AI detector automatically detects `best.pt` on the fly and utilizes its trained classes (e.g., `helmet`, `no-helmet`, `motorcycle`, `license_plate`).
3. **Standby Mode**: If `best.pt` is not placed yet, the backend automatically falls back to standard YOLO / heuristic mode and provides a 1-click **"Try Demo Traffic Video"** generator so you can test the entire pipeline immediately!

---

## 💻 Running the Application

### Manual Launch
1. **Start Backend**:
   ```bash
   cd TrafficWebsite/backend
   python -m uvicorn main:app --reload --port 8000
   ```
   Backend runs at: `http://127.0.0.1:8000` (Swagger docs at `http://127.0.0.1:8000/docs`)

2. **Start Frontend**:
   ```bash
   cd TrafficWebsite/frontend
   npm run dev
   ```
   Frontend runs at: `http://localhost:5173`

---

## 🌟 Key Features

- **Multi-Violation Detection**:
  - ⛑️ **Helmet Non-Compliance**: Identifies motorcycle riders operating vehicles without mandatory headgear.
  - 🏎️ **Over-Speeding**: Calculates pixel displacement over time calibrated to real-world velocity (km/h) against road speed limits.
  - 👥 **Triple Riding**: Detects 3 or more passengers overloaded on a single motorcycle.
- **Dual Video Surveillance Player**:
  - Toggle between **AI Annotated HUD Video** and **Raw Camera Feed**.
  - Interactive **Violation Timeline Seek Bar**: Click on any red marker pin on the timeline to seek the video straight to that exact timestamp!
- **Forensic Evidence Extraction**:
  - High-resolution JPEG snapshots captured automatically for each unique violation with vehicle bounding box and timestamp header banner.
  - Snapshot Lightbox with direct download capability.
- **Automated E-Challan / Citation Generator**:
  - Generates official traffic violation notices with violation section citation, calculated fine amount, snapshot evidence, and printable layout.
- **1-Click Synthetic Traffic Demo Generator**:
  - Built-in OpenCV video synthesizer generates multi-lane road traffic with moving cars, motorcycles, and violations for rapid testing without requiring external video files.
