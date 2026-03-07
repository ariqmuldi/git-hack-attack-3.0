"use client";

import { useEffect, useRef, useState } from "react";

const VISION_SERVER = "http://localhost:8000";

interface KioskFrontCameraProps {
  onPartySizeChange?: (count: number) => void;
}

export default function KioskFrontCamera({ onPartySizeChange }: KioskFrontCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inflight = useRef(false);
  const [partySize, setPartySize] = useState<number | null>(null);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        intervalId = setInterval(detectFrame, 300);
      } catch {
        setCameraError(true);
      }
    }

    function detectFrame() {
      if (inflight.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const scale = 320 / (video.videoWidth || 640);
      canvas.width = 320;
      canvas.height = Math.round((video.videoHeight || 480) * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

      inflight.current = true;
      fetch(`${VISION_SERVER}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      })
        .then((r) => r.json())
        .then((data) => {
          setPartySize(data.count);
          setAnnotatedFrame(`data:image/jpeg;base64,${data.annotated_frame}`);
          onPartySizeChange?.(data.count);
        })
        .catch(() => {
          // Vision server not running
        })
        .finally(() => {
          inflight.current = false;
        });
    }

    startCamera();

    return () => {
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onPartySizeChange]);

  return (
    <div className="w-2/3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Live Detection
        </p>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      {cameraError ? (
        <div className="flex h-40 items-center justify-center rounded-xl bg-zinc-50 text-xs text-zinc-400">
          Camera unavailable
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full ${annotatedFrame ? "hidden" : "block"}`}
          />
          {annotatedFrame && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={annotatedFrame}
              alt="YOLO detection"
              className="w-full"
            />
          )}
          {partySize !== null && (
            <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              {partySize} {partySize === 1 ? "person" : "people"}
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
