"""
FastAPI server exposing a /detect endpoint for person counting via YOLOv8.
Run from the repo root: uvicorn vision.server:app --port 8000 --reload
"""
from __future__ import annotations

import base64
import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Model setup
# ---------------------------------------------------------------------------
_MODELS_DIR = Path(__file__).resolve().parent / "models"
_MODELS_DIR.mkdir(parents=True, exist_ok=True)
_MODEL_PATH = _MODELS_DIR / "yolov8n.pt"

print(f"Loading YOLO model from {_MODEL_PATH} …", file=sys.stderr)
model = YOLO(str(_MODEL_PATH))
print("Model ready.", file=sys.stderr)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Reception Vision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class DetectRequest(BaseModel):
    image: str  # base64-encoded JPEG


class DetectResponse(BaseModel):
    count: int
    annotated_frame: str  # base64-encoded JPEG with bounding boxes


@app.post("/detect", response_model=DetectResponse)
async def detect(req: DetectRequest) -> DetectResponse:
    # Decode the incoming frame
    img_bytes = base64.b64decode(req.image)
    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        return DetectResponse(count=0, annotated_frame=req.image)

    # Run YOLO (person class = 0 only)
    results = model(frame, classes=[0], conf=0.35, imgsz=320, verbose=False)
    result = results[0]

    count = len(result.boxes) if result.boxes is not None else 0

    # Draw bounding boxes
    annotated = result.plot()

    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
    annotated_b64 = base64.b64encode(buf).decode()

    return DetectResponse(count=count, annotated_frame=annotated_b64)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
