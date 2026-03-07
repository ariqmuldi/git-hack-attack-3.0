"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const VISION_SERVER = "http://localhost:8000";

export default function WelcomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inflight = useRef(false);
  const [partySize, setPartySize] = useState<number | null>(null);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [arrivalTime, setArrivalTime] = useState<string | null>(null);
  const prevPartySize = useRef<number | null>(null);

  useEffect(() => {
    if (partySize === null) return;
    const wasEmpty = prevPartySize.current === null || prevPartySize.current === 0;
    if (partySize > 0 && wasEmpty) {
      // First detection — lock the arrival time
      setArrivalTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } else if (partySize === 0) {
      // Everyone left — reset so next arrival gets a fresh timestamp
      setArrivalTime(null);
    }
    prevPartySize.current = partySize;
  }, [partySize]);

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
      if (inflight.current) return; // skip if previous request still running
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      // Scale down to 320px wide to reduce transfer size and YOLO input size
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
        })
        .catch(() => {
          // Vision server not running — camera still shows, count stays null
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
  }, []);

  const displaySize =
    partySize !== null
      ? `Party of ${partySize} detected.`
      : "Detecting party size…";

  return (
    <main className="min-h-screen bg-zinc-50 font-sans antialiased text-black">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-10 md:px-10">
        <header className="mb-12 flex items-center justify-between">
          <p className="text-2xl font-semibold tracking-tight">Restaurant X</p>
          <p className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
            Kiosk Check-in
          </p>
        </header>

        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Welcome
            </p>
            <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-7xl">
              Welcome to
              <br />
              Restaurant X
            </h1>
            <p className="mt-5 max-w-xl text-lg text-zinc-500 md:text-2xl">
              {displaySize} Do you have a reservation?
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/customer/confirm-reservation"
                className="rounded-lg bg-black px-7 py-4 text-center text-base font-semibold text-white transition hover:bg-zinc-800"
              >
                Yes, I do
              </Link>
              <Link
                href="/admin/customer/table-free"
                className="rounded-lg border border-zinc-300 bg-white px-7 py-4 text-center text-base font-semibold text-black transition hover:border-zinc-500"
              >
                No reservation
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Party Size
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {partySize !== null ? `${partySize} Guests` : "Detecting…"}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Arrival Time
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {arrivalTime ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Need Assistance?
                </p>
                <button
                  type="button"
                  className="mt-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Call Staff
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Live camera feed */}
        <section className="mt-10 flex justify-center">
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
          </div>
        </section>
      </div>

      {/* Hidden canvas used for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
