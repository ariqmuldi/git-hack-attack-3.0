"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Camera,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  Database,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const VISION_SERVER = process.env.NEXT_PUBLIC_VISION_SERVER ?? "http://localhost:8000";

type DashboardTab = "overview" | "analytics" | "notifications" | "cameras";
type AlertLevel = "critical" | "warning" | "info";
type CameraStatus = "online" | "degraded" | "offline";

interface CameraPreset {
  id: string;
  name: string;
  zone: string;
  seatTarget: number;
  peopleOffset: number;
  filter: string;
}

interface AlertItem {
  id: string;
  title: string;
  detail: string;
  source: string;
  level: AlertLevel;
  createdAt: number;
}

const TABS: Array<{ id: DashboardTab; label: string; icon: typeof Camera }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "cameras", label: "Cameras", icon: Camera },
];

const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "CAM-01",
    name: "Main Entrance",
    zone: "Front Door",
    seatTarget: 12,
    peopleOffset: 0,
    filter: "saturate(1.05)",
  },
  {
    id: "CAM-02",
    name: "Dining Floor",
    zone: "Center Aisle",
    seatTarget: 26,
    peopleOffset: 2,
    filter: "contrast(1.03)",
  },
  {
    id: "CAM-03",
    name: "Bar + Lounge",
    zone: "North Wing",
    seatTarget: 18,
    peopleOffset: -1,
    filter: "brightness(1.06)",
  },
  {
    id: "CAM-04",
    name: "Patio Access",
    zone: "Outdoor Gate",
    seatTarget: 10,
    peopleOffset: 1,
    filter: "hue-rotate(2deg)",
  },
];

const HOURLY_TRAFFIC = [6, 8, 9, 13, 16, 18, 21, 26, 24, 20, 14, 9];

const ALERT_LEVEL_CLASS: Record<AlertLevel, string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const CAMERA_STATUS_CLASS: Record<CameraStatus, string> = {
  online: "border-emerald-200 bg-emerald-50 text-emerald-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-red-200 bg-red-50 text-red-700",
};

function formatRelativeTime(createdAt: number): string {
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - createdAt) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  return `${Math.floor(deltaSeconds / 3600)}h ago`;
}

function formatUptime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

function CameraFeedTile({
  camera,
  stream,
  status,
  peopleCount,
  fps,
  latencyMs,
  visionConnected,
}: {
  camera: CameraPreset;
  stream: MediaStream | null;
  status: CameraStatus;
  peopleCount: number;
  fps: number;
  latencyMs: number;
  visionConnected: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    if (stream) {
      video.play().catch(() => {
        // Camera autoplay can be blocked on some browsers until user interaction.
      });
    }

    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{camera.name}</p>
          <p className="text-xs text-zinc-500">
            {camera.id} • {camera.zone}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${CAMERA_STATUS_CLASS[status]}`}
        >
          {status}
        </span>
      </div>

      <div className="relative bg-zinc-950">
        {stream ? (
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full object-cover"
            style={{ filter: camera.filter }}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-zinc-300">
            Camera unavailable
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {peopleCount} people
          </span>
          <span className="rounded-md bg-black/70 px-2 py-1 text-xs text-zinc-200 backdrop-blur-sm">
            {fps} FPS
          </span>
          <span className="rounded-md bg-black/70 px-2 py-1 text-xs text-zinc-200 backdrop-blur-sm">
            {latencyMs}ms
          </span>
        </div>
        {!visionConnected && (
          <div className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs text-amber-200 backdrop-blur-sm">
            Vision server offline
          </div>
        )}
      </div>
    </article>
  );
}

export default function BusinessDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [visionConnected, setVisionConnected] = useState(false);
  const [peopleCount, setPeopleCount] = useState(0);
  const [lastVisionUpdate, setLastVisionUpdate] = useState<string>("Not connected");
  const [estimatedFps, setEstimatedFps] = useState(0);
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [alerts, setAlerts] = useState<AlertItem[]>(() => [
    {
      id: "seed-1",
      title: "Queue growth at entrance",
      detail: "Front-door dwell time crossed 95 seconds.",
      source: "CAM-01",
      level: "warning",
      createdAt: Date.now() - 3 * 60 * 1000,
    },
    {
      id: "seed-2",
      title: "Patio gate access opened",
      detail: "Patio gate opened after closing profile window.",
      source: "CAM-04",
      level: "critical",
      createdAt: Date.now() - 7 * 60 * 1000,
    },
    {
      id: "seed-3",
      title: "Analytics snapshot synced",
      detail: "Floor occupancy snapshot written to storage.",
      source: "System",
      level: "info",
      createdAt: Date.now() - 12 * 60 * 1000,
    },
  ]);

  const lastCrowdAlertTs = useRef(0);
  const analysisVideoRef = useRef<HTMLVideoElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectInflightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let currentStream: MediaStream | null = null;

    async function initCamera() {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          currentStream.getTracks().forEach((track) => track.stop());
          return;
        }

        setStream(currentStream);
        setCameraError(null);
      } catch {
        setCameraError("Camera permission was denied or no camera is available.");
      }
    }

    initCamera();

    return () => {
      cancelled = true;
      currentStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = analysisVideoRef.current;
    if (!video) return;

    video.srcObject = stream;
    if (stream) {
      video.play().catch(() => {
        // Autoplay may fail before user gesture; visual feeds still start after interaction.
      });
    }
  }, [stream]);

  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!stream) return;

    const video = analysisVideoRef.current;
    const canvas = analysisCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!video || !canvas || !ctx) return;

    const detectFrame = () => {
      if (detectInflightRef.current) return;
      if (video.readyState < 2) return;

      const width = 360;
      const scale = width / (video.videoWidth || 1280);
      const height = Math.round((video.videoHeight || 720) * scale);
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);

      const image = canvas.toDataURL("image/jpeg", 0.72).split(",")[1];
      const startedAt = performance.now();
      detectInflightRef.current = true;

      fetch(`${VISION_SERVER}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Vision endpoint unavailable");
          }
          return response.json();
        })
        .then((payload: { count?: number }) => {
          const count = typeof payload.count === "number" ? payload.count : 0;
          setPeopleCount(count);
          setVisionConnected(true);
          setLastVisionUpdate(new Date().toLocaleTimeString());

          if (count >= 6) {
            const now = Date.now();
            if (now - lastCrowdAlertTs.current >= 30_000) {
              lastCrowdAlertTs.current = now;
              setAlerts((prev) => [
                {
                  id: `crowd-${now}`,
                  title: "High guest density detected",
                  detail: `Entrance occupancy reached ${count} people.`,
                  source: "CAM-01",
                  level: "warning",
                  createdAt: now,
                },
                ...prev,
              ]);
            }
          }

          const cycleMs = performance.now() - startedAt;
          const fps = Math.max(1, Math.round(1000 / Math.max(cycleMs, 1)));
          setEstimatedFps(fps);
        })
        .catch(() => {
          setVisionConnected(false);
        })
        .finally(() => {
          detectInflightRef.current = false;
        });
    };

    detectFrame();
    const interval = setInterval(detectFrame, 900);
    return () => clearInterval(interval);
  }, [stream]);

  const cameraView = useMemo(() => {
    return CAMERA_PRESETS.map((camera, index) => {
      const status: CameraStatus = stream
        ? visionConnected
          ? "online"
          : "degraded"
        : "offline";

      return {
        ...camera,
        status,
        peopleCount: Math.max(0, peopleCount + camera.peopleOffset),
        fps: stream ? Math.max(4, estimatedFps - index) : 0,
        latencyMs: stream ? 84 + index * 11 : 0,
      };
    });
  }, [estimatedFps, peopleCount, stream, visionConnected]);

  const activeAlerts = alerts.filter((item) => item.level !== "info").length;
  const occupancyPercent = Math.min(98, Math.max(6, peopleCount * 12));
  const avgFillPercent = Math.min(
    100,
    Math.round(
      cameraView.reduce(
        (sum, camera) => sum + (camera.peopleCount / camera.seatTarget) * 100,
        0
      ) / cameraView.length
    )
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-50 to-white font-[var(--font-kiosk)] text-zinc-900 antialiased">
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10">
        <header className="rounded-2xl border border-zinc-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Restaurant Security Operations
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
                Business Dashboard
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Lumana-inspired live monitoring with camera wall, analytics, and incident feeds.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
                Uptime {formatUptime(uptimeSeconds)}
              </span>
              <span
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  visionConnected
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {visionConnected ? "Vision API Connected" : "Vision API Offline"}
              </span>
              <Button className="bg-black px-5 text-white hover:bg-zinc-800">
                Export Incident Log
              </Button>
            </div>
          </div>
        </header>

        <nav className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-black text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {cameraError && (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {cameraError}
          </section>
        )}

        {activeTab === "overview" && (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">Active Cameras</p>
                  <Camera className="size-4 text-zinc-400" />
                </div>
                <p className="mt-2 text-3xl font-semibold">{cameraView.length}</p>
                <p className="mt-1 text-xs text-zinc-500">Mirroring primary stream for demo wall</p>
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">Live Occupancy</p>
                  <Wifi className="size-4 text-zinc-400" />
                </div>
                <p className="mt-2 text-3xl font-semibold">{occupancyPercent}%</p>
                <p className="mt-1 text-xs text-zinc-500">Updated {lastVisionUpdate}</p>
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">Open Alerts</p>
                  <CircleAlert className="size-4 text-zinc-400" />
                </div>
                <p className="mt-2 text-3xl font-semibold">{activeAlerts}</p>
                <p className="mt-1 text-xs text-zinc-500">Critical and warning incidents</p>
              </article>

              <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500">Table Fill Average</p>
                  <ShieldCheck className="size-4 text-zinc-400" />
                </div>
                <p className="mt-2 text-3xl font-semibold">{avgFillPercent}%</p>
                <p className="mt-1 text-xs text-zinc-500">Across monitored zones</p>
              </article>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Live Camera Wall</h2>
                    <p className="text-sm text-zinc-500">
                      Multi-camera real-time feed with occupancy overlays.
                    </p>
                  </div>
                  <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                    4 Feeds
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {cameraView.map((camera) => (
                    <CameraFeedTile
                      key={camera.id}
                      camera={camera}
                      stream={stream}
                      status={camera.status}
                      peopleCount={camera.peopleCount}
                      fps={camera.fps}
                      latencyMs={camera.latencyMs}
                      visionConnected={visionConnected}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Incident Feed
                  </h3>
                  <div className="mt-3 flex flex-col gap-2">
                    {alerts.slice(0, 6).map((alert) => (
                      <article
                        key={alert.id}
                        className={`rounded-xl border px-3 py-2 ${ALERT_LEVEL_CLASS[alert.level]}`}
                      >
                        <p className="text-sm font-semibold">{alert.title}</p>
                        <p className="mt-0.5 text-xs">{alert.detail}</p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                          {alert.source} • {formatRelativeTime(alert.createdAt)}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Quick Actions
                  </h3>
                  <div className="mt-3 flex flex-col gap-2">
                    <Button variant="outline" className="justify-start">
                      Run camera health check
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Notify floor manager
                    </Button>
                    <Button variant="outline" className="justify-start">
                      Snapshot all feeds
                    </Button>
                  </div>
                </section>
              </div>
            </section>
          </>
        )}

        {activeTab === "analytics" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Guest Traffic Trend</h2>
                <span className="text-xs text-zinc-500">Last 12 intervals</span>
              </div>
              <div className="mt-5 flex h-64 items-end gap-2">
                {HOURLY_TRAFFIC.map((value, index) => (
                  <div key={`traffic-${index}`} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-zinc-900 to-zinc-500"
                      style={{ height: `${Math.max(8, value * 3)}px` }}
                    />
                    <span className="text-[11px] text-zinc-500">{index + 1}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Zone Utilization</h2>
              <div className="mt-4 flex flex-col gap-4">
                {cameraView.map((camera) => {
                  const fill = Math.min(
                    100,
                    Math.round((camera.peopleCount / camera.seatTarget) * 100)
                  );
                  return (
                    <div key={`util-${camera.id}`}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{camera.name}</span>
                        <span className="text-zinc-500">{fill}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-zinc-900"
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
              <h2 className="text-lg font-semibold">System Health Snapshot</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-500">Detection Throughput</p>
                  <p className="mt-1 text-2xl font-semibold">{estimatedFps || 0} FPS</p>
                  <p className="mt-1 text-xs text-zinc-500">Pipeline response estimate</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-500">Data Sync</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {visionConnected ? "Healthy" : "Degraded"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Last update {lastVisionUpdate}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-500">Runtime</p>
                  <p className="mt-1 text-2xl font-semibold">{formatUptime(uptimeSeconds)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Continuous monitoring window</p>
                </div>
              </div>
            </article>
          </section>
        )}

        {activeTab === "notifications" && (
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Notifications & Incidents</h2>
              <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600">
                {alerts.length} total events
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {alerts.map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-xl border border-zinc-200 px-4 py-3 transition hover:border-zinc-300"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ALERT_LEVEL_CLASS[alert.level]}`}
                      >
                        {alert.level}
                      </span>
                      <div>
                        <p className="font-semibold text-zinc-900">{alert.title}</p>
                        <p className="text-sm text-zinc-600">{alert.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Clock3 className="size-3.5" />
                      <span>{formatRelativeTime(alert.createdAt)}</span>
                      <span>•</span>
                      <span>{alert.source}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "cameras" && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Camera Fleet</h2>
                <Button variant="outline">Add Camera</Button>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Camera</th>
                      <th className="px-4 py-3 font-semibold">Zone</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Live Count</th>
                      <th className="px-4 py-3 font-semibold">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-sm">
                    {cameraView.map((camera) => (
                      <tr key={`row-${camera.id}`} className="bg-white">
                        <td className="px-4 py-3 font-semibold text-zinc-900">{camera.id}</td>
                        <td className="px-4 py-3 text-zinc-600">{camera.zone}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${CAMERA_STATUS_CLASS[camera.status]}`}
                          >
                            {camera.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{camera.peopleCount} people</td>
                        <td className="px-4 py-3 text-zinc-700">{camera.latencyMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Infrastructure</h2>
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Vision API</p>
                    <Database className="size-4 text-zinc-400" />
                  </div>
                  <p className="mt-1 text-xl font-semibold">
                    {visionConnected ? "Connected" : "Unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{VISION_SERVER}</p>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Camera Runtime</p>
                    <Activity className="size-4 text-zinc-400" />
                  </div>
                  <p className="mt-1 text-xl font-semibold">
                    {stream ? "Streaming" : "Stopped"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Uptime {formatUptime(uptimeSeconds)}</p>
                </div>
              </div>
            </article>
          </section>
        )}
      </div>

      <video ref={analysisVideoRef} muted playsInline className="hidden" />
      <canvas ref={analysisCanvasRef} className="hidden" />
    </main>
  );
}
