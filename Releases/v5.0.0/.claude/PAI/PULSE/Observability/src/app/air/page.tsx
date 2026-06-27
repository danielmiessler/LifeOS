"use client";

import { useEffect, useState } from "react";
import { Wind, Thermometer, Droplets, Cloud, Sparkles, MapPin, Home, Trees } from "lucide-react";
import EmptyStateGuide from "@/components/EmptyStateGuide";

interface AirMonitor {
  id: number;
  name: string;
  pm25: number | null;
  co2: number | null;
  temp: number | null;
  rh: number | null;
  tvoc: number | null;
  nox: number | null;
  aqi: number | null;
  aqiLabel: string | null;
  timestamp: string;
  type: string | null;
}

interface AirData {
  fetched_at: string | null;
  count: number;
  worst_aqi: number | null;
  worst_label: string | null;
  monitors: AirMonitor[];
  error?: string;
}

// AQI color scale — retained because this is the official US EPA semantic palette
// for air quality. It is data, not decorative UI, so blue-only would mislead.
function aqiTextColor(aqi: number | null): string {
  if (aqi === null) return "#6B80AB";
  if (aqi <= 50) return "#4ADE80";
  if (aqi <= 100) return "#FBBF24";
  if (aqi <= 150) return "#F59E0B";
  if (aqi <= 200) return "#F87171";
  if (aqi <= 300) return "#A855F7";
  return "#B91C1C";
}

function aqiBorderColor(aqi: number | null): string {
  return aqiTextColor(aqi);
}

function co2Color(co2: number | null): string {
  if (co2 === null) return "#6B80AB";
  if (co2 < 800) return "#4ADE80";
  if (co2 < 1200) return "#FBBF24";
  if (co2 < 2000) return "#F59E0B";
  return "#F87171";
}

function co2Label(co2: number | null): string {
  if (co2 === null) return "";
  if (co2 < 800) return "fresh";
  if (co2 < 1200) return "elevated";
  if (co2 < 2000) return "stuffy";
  return "poor";
}

function freshness(iso: string | null): string {
  if (!iso) return "unknown";
  const age = Date.now() - new Date(iso).getTime();
  const m = Math.round(age / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function monitorIcon(m: AirMonitor) {
  const name = m.name.toLowerCase();
  if (name.includes("backyard") || name.includes("outside") || m.type === "outdoor") return Trees;
  if (name.includes("bedroom") || name.includes("living") || name.includes("studio")) return Home;
  return MapPin;
}

function Banner({ air }: { air: AirData | null }) {
  const worstAqi = air?.worst_aqi ?? null;
  const worstLabel = air?.worst_label ?? null;
  const count = air?.count ?? 0;
  const fetched = freshness(air?.fetched_at ?? null);
  return (
    <section
      className="telos-card mission-card dim-health"
      style={{
        cursor: "default",
        padding: 32,
        background: "linear-gradient(90deg, rgba(52,211,153,0.08), #0F1A33)",
      }}
    >
      <div className="absolute top-5 right-5 green-up" style={{ fontSize: 12, position: "absolute" }}>
        cached {fetched}
      </div>
      <div className="flex items-start gap-6 flex-wrap">
        <Wind className="w-10 h-10 shrink-0" style={{ color: "var(--health)" }} />
        <div className="flex-1 min-w-0">
          <div className="mission-eyebrow">Air Quality</div>
          <p
            className="leading-snug mission-title"
            style={{ fontSize: "clamp(22px, 2.5vw, 30px)", fontWeight: 500, marginTop: 6 }}
          >
            Worst AQI across {count} monitor{count === 1 ? "" : "s"}:{" "}
            <span className="tabular-nums" style={{ color: aqiTextColor(worstAqi), fontWeight: 700 }}>
              {worstAqi ?? "—"}
            </span>
            {worstLabel && (
              <span className="ml-2" style={{ color: aqiTextColor(worstAqi), fontSize: "0.7em" }}>
                ({worstLabel})
              </span>
            )}
          </p>
          <p className="mt-2" style={{ color: "#9BB0D6", fontSize: 14 }}>
            Live from AirGradient · updated every 5 min by Pulse poller
          </p>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: typeof Wind;
  label: string;
  value: string | null;
  unit?: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "#6B80AB" }}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>
        {value ?? "—"}
        {value !== null && unit && (
          <span className="text-xs ml-1" style={{ color: "#6B80AB", fontWeight: 400 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

function MonitorCard({ m }: { m: AirMonitor }) {
  const Icon = monitorIcon(m);
  const aqi = m.aqi;
  const co2 = m.co2;
  const co2Lbl = co2Label(co2);
  const accent = aqiBorderColor(aqi);
  return (
    <div
      className="telos-card metric"
      style={{ cursor: "default", padding: 20, borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: "var(--health)" }} />
          <h3 className="text-base font-semibold" style={{ color: "#E8EFFF" }}>{m.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {m.type && <span className="pill pill-health">{m.type}</span>}
          <span
            className="pill"
            style={{
              background: `${aqiTextColor(aqi)}1A`,
              color: aqiTextColor(aqi),
              border: `1px solid ${aqiTextColor(aqi)}55`,
              fontSize: 10,
            }}
          >
            AQI {aqi ?? "—"}
            {m.aqiLabel && ` · ${m.aqiLabel}`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Metric
          icon={Cloud}
          label="PM 2.5"
          value={m.pm25 !== null ? m.pm25.toFixed(1) : null}
          unit="µg/m³"
          color={aqiTextColor(aqi)}
        />
        <Metric
          icon={Wind}
          label="CO₂"
          value={co2 !== null ? String(co2) : null}
          unit={co2Lbl ? `ppm · ${co2Lbl}` : "ppm"}
          color={co2Color(co2)}
        />
        <Metric
          icon={Thermometer}
          label="Temp"
          value={m.temp !== null ? m.temp.toFixed(1) : null}
          unit="°C"
          color="var(--rhythms)"
        />
        <Metric
          icon={Droplets}
          label="Humidity"
          value={m.rh !== null ? String(m.rh) : null}
          unit="%"
          color="var(--health)"
        />
        <Metric
          icon={Sparkles}
          label="TVOC"
          value={m.tvoc !== null ? String(m.tvoc) : null}
          unit="idx"
          color="var(--relationships)"
        />
        <Metric
          icon={Sparkles}
          label="NOx"
          value={m.nox !== null ? String(m.nox) : null}
          unit="idx"
          color="var(--freedom)"
        />
      </div>
      <div
        className="mt-4 pt-3 flex items-center justify-between text-[11px]"
        style={{ borderTop: "1px dashed #1A2A4D", color: "#6B80AB" }}
      >
        <span>
          id {m.id}
          {m.type ? ` · ${m.type}` : ""}
        </span>
        <span>{freshness(m.timestamp)}</span>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="telos-card" style={{ cursor: "default", padding: 16 }}>
      <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "#6B80AB" }}>
        US AQI (PM2.5) scale
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        {[
          { color: "#4ADE80", label: "0–50 Good" },
          { color: "#FBBF24", label: "51–100 Moderate" },
          { color: "#F59E0B", label: "101–150 USG" },
          { color: "#F87171", label: "151–200 Unhealthy" },
          { color: "#A855F7", label: "201–300 Very Unhealthy" },
          { color: "#B91C1C", label: "300+ Hazardous" },
        ].map((band) => (
          <div key={band.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ background: band.color }} />
            <span style={{ color: "#9BB0D6" }}>{band.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 text-[11px]" style={{ borderTop: "1px dashed #1A2A4D", color: "#6B80AB" }}>
        <span style={{ color: "#4ADE80" }}>CO₂ &lt; 800</span> fresh ·{" "}
        <span style={{ color: "#FBBF24" }}>800–1200</span> elevated ·{" "}
        <span style={{ color: "#F59E0B" }}>1200–2000</span> stuffy ·{" "}
        <span style={{ color: "#F87171" }}>&gt; 2000</span> poor
      </div>
    </div>
  );
}

export default function AirPage() {
  const [air, setAir] = useState<AirData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/life/air")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setAir)
      .catch((err) => setError(String(err)));
    const interval = setInterval(() => {
      fetch("/api/life/air")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setAir(d))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div
          className="telos-card"
          style={{ cursor: "default", borderLeft: "3px solid #F87171" }}
        >
          <div style={{ color: "#F87171", fontSize: 14 }}>Air Quality unavailable: {error}</div>
        </div>
      </div>
    );
  }

  const monitors = air?.monitors ?? [];
  const sorted = [...monitors].sort((a, b) => {
    const aOut = a.type === "outdoor" || a.name.toLowerCase().includes("backyard") ? 1 : 0;
    const bOut = b.type === "outdoor" || b.name.toLowerCase().includes("backyard") ? 1 : 0;
    return aOut - bOut || a.name.localeCompare(b.name);
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6" style={{ position: "relative" }}>
      <Banner air={air} />
      <Legend />
      {sorted.length === 0 ? (
        <>
          <EmptyStateGuide
            section="Air Quality"
            description="Indoor air monitoring data. Add an AirGradient (or compatible) device and wire its API key to populate."
            hideInterview
            daPromptExample="walk me through connecting an air quality sensor"
          />
          <div className="telos-card" style={{ cursor: "default" }}>
            <div className="p-4 text-center" style={{ color: "#9BB0D6", fontSize: 14 }}>
              No monitors in cache yet. Run{" "}
              <code
                className="px-2 py-0.5 rounded mono"
                style={{ background: "#12203D", color: "#E8EFFF" }}
              >
                bun $PAI_DIR/PULSE/checks/airgradient-poll.ts
              </code>{" "}
              to prime, or wait for the next 5-minute poll.
            </div>
          </div>
        </>
      ) : (
        <section className="space-y-4">
          {sorted.map((m) => (
            <MonitorCard key={m.id} m={m} />
          ))}
        </section>
      )}
    </div>
  );
}
