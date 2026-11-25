# backend/main.py
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from detector import TrafficDetector

app = FastAPI(title="Traffic Violation Review API")

# Enable CORS for React frontend (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create static directories
Path("static/videos").mkdir(parents=True, exist_ok=True)
Path("static/evidence").mkdir(parents=True, exist_ok=True)
Path("weights").mkdir(parents=True, exist_ok=True)

# Mount static files to serve video and snapshot images
app.mount("/static", StaticFiles(directory="static"), name="static")

# Load model once at startup
detector = TrafficDetector(model_path="weights/best.pt")

@app.post("/api/process-video")
async def process_video_endpoint(file: UploadFile = File(...)):
    raw_path = f"static/videos/{file.filename}"
    with open(raw_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run detection pipeline
    result = detector.process_video(input_path=raw_path, output_dir="static")
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)