"use client";

import { useEffect, useState } from "react";
import type { CompanyWizardData } from "@/lib/report/aggregate";

const CIRCUMFERENCE = 2 * Math.PI * 64; // ≈ 402.1

function useCountUp(target: number, duration = 1200, delay = 150) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    const id = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(id);
  }, [target, duration, delay]);
  return value;
}

interface RingCardProps {
  title:   string;
  pct:     number;
  color:   string;
  caption: string;
}

function RingCard({ title, pct, color, caption }: RingCardProps) {
  const [animated, setAnimated] = useState(0);
  const displayed = useCountUp(pct);

  useEffect(() => {
    setAnimated(0);
    const id = setTimeout(() => setAnimated(pct), 150);
    return () => clearTimeout(id);
  }, [pct]);

  const offset = CIRCUMFERENCE * (1 - animated / 100);

  return (
    <div
      style={{
        background:    "rgba(255,255,255,0.05)",
        border:        "1px solid rgba(255,255,255,0.1)",
        borderRadius:  16,
        padding:       "36px 28px",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           20,
        transition:    "border-color .2s, transform .2s",
        cursor:        "default",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(74,222,128,0.25)";
        (e.currentTarget as HTMLDivElement).style.transform   = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)";
        (e.currentTarget as HTMLDivElement).style.transform   = "translateY(0)";
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", textAlign: "center" }}>{title}</p>
      <div style={{ position: "relative", width: 160, height: 160 }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
          <circle
            cx="80" cy="80" r="64"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.25, 1, 0.5, 1)" }}
          />
        </svg>
        <div style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       34,
          fontWeight:     900,
          color:          "#fff",
        }}>
          {displayed}%
        </div>
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.55 }}>{caption}</p>
    </div>
  );
}

interface Props {
  company:   string;
  data:      CompanyWizardData;
  isMobile?: boolean;
}

export default function Step2Benefit({ company, data, isMobile }: Props) {
  return (
    <div style={{ width: "100%", maxWidth: 960, paddingTop: isMobile ? 24 : 0, paddingBottom: isMobile ? 24 : 0 }}>
      <h1 style={{
        fontSize:      "clamp(22px,3vw,36px)",
        fontWeight:    800,
        lineHeight:    1.2,
        letterSpacing: -0.3,
        marginBottom:  12,
        color:         "#fff",
      }}>
        How <span style={{ color: "#4ade80" }}>{company}&apos;s</span> workforce can benefit from AI
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 640, marginBottom: isMobile ? 24 : 48 }}>
        Here&apos;s the level of AI opportunity your workforce will experience. Our analysis shows which jobs remain human-led and which are to be enhanced by AI.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, maxWidth: 760, margin: "0 auto" }}>
        <RingCard
          title="Human AI Partnership Opportunity"
          pct={data.humanAiPartnership}
          color="#6094FF"
          caption="of roles benefit most from maximizing human–AI collaboration"
        />
        <RingCard
          title="Transformation Opportunity"
          pct={data.transformationOpportunity}
          color="#4ade80"
          caption="of roles might require significant reskilling and role redesign"
        />
      </div>
    </div>
  );
}
