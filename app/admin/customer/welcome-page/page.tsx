"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const VISION_SERVER = "http://localhost:8000";

type MessageStage = "greeting" | "party-size" | "reservation-prompt" | "buttons";

interface TypedMessage {
  text: string;
  displayedText: string;
  isComplete: boolean;
}

export default function WelcomePage() {
  // Camera / YOLO state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inflight = useRef(false);
  const [partySize, setPartySize] = useState<number | null>(null);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const prevPartySize = useRef<number | null>(null);

  // Typing animation state
  const [stage, setStage] = useState<MessageStage>("greeting");
  const [messages, setMessages] = useState<TypedMessage[]>([
    { text: "Welcome to Restaurant X", displayedText: "", isComplete: false },
  ]);
  const [showButtons, setShowButtons] = useState(false);

  const typingSpeed = 50;

  // Track previous party size for change detection
  useEffect(() => {
    prevPartySize.current = partySize;
  }, [partySize]);

  // Camera setup and YOLO detection
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

  // Typing animation effect
  useEffect(() => {
    const currentMessage = messages[messages.length - 1];
    if (!currentMessage || currentMessage.isComplete) return;

    const timeout = setTimeout(() => {
      const nextChar = currentMessage.text[currentMessage.displayedText.length];
      const updatedMessages = [...messages];
      updatedMessages[updatedMessages.length - 1] = {
        ...currentMessage,
        displayedText: currentMessage.displayedText + nextChar,
      };
      if (updatedMessages[updatedMessages.length - 1].displayedText.length === currentMessage.text.length) {
        updatedMessages[updatedMessages.length - 1].isComplete = true;
      }
      setMessages(updatedMessages);
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [messages]);

  // Stage transition effect
  useEffect(() => {
    const currentMessage = messages[messages.length - 1];
    if (!currentMessage?.isComplete) return;

    const transitionTimer = setTimeout(() => {
      switch (stage) {
        case "greeting":
          setStage("party-size");
          setMessages((prev) => [
            ...prev,
            {
              text: `We saw you have a party of ${partySize ?? "?"}.`,
              displayedText: "",
              isComplete: false,
            },
          ]);
          break;

        case "party-size":
          setStage("reservation-prompt");
          setMessages((prev) => [
            ...prev,
            {
              text: "Do you have a reservation?",
              displayedText: "",
              isComplete: false,
            },
          ]);
          break;

        case "reservation-prompt":
          setStage("buttons");
          setShowButtons(true);
          break;

        case "buttons":
          break;
      }
    }, 2000);

    return () => clearTimeout(transitionTimer);
  }, [stage, messages, partySize]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 font-sans antialiased text-black">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-10 md:px-10">
        {/* Header */}
        <header className="mb-20 flex items-center justify-between">
          <p className="text-2xl font-semibold tracking-tight">Restaurant X</p>
          <p className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
            Kiosk Check-in
          </p>
        </header>

        {/* Conversation Container */}
        <section className="flex flex-col items-center justify-center min-h-[500px]">
          <div className="w-full max-w-2xl space-y-6">
            {messages.length > 0 && (
              <div className="animate-fade-in">
                <h1 className="text-4xl md:text-6xl font-bold text-black leading-tight tracking-tight min-h-[80px]">
                  {messages[messages.length - 1].displayedText}
                  {!messages[messages.length - 1].isComplete && (
                    <span className="animate-pulse">|</span>
                  )}
                </h1>
              </div>
            )}

            {showButtons && (
              <div className="mt-12 flex flex-col gap-4 sm:flex-row animate-fade-in">
                <Link
                  href="/admin/customer/confirm-reservation"
                  className="flex-1 rounded-lg bg-black px-8 py-5 text-center text-base font-semibold text-white transition hover:bg-zinc-800 active:bg-black"
                >
                  Yes, I do
                </Link>
                <Link
                  href="/admin/customer/table-free"
                  className="flex-1 rounded-lg border-2 border-black bg-white px-8 py-5 text-center text-base font-semibold text-black transition hover:bg-black hover:text-white"
                >
                  No reservation
                </Link>
              </div>
            )}
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

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </main>
  );
}
