"use client";

import { useEffect, useState } from "react";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export default function ScoreRing({
  score,
  size = 140,
  strokeWidth = 10,
  color = "#7c3aed",
  label,
  sublabel,
}: Props) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const getColor = (s: number) => {
    if (s >= 70) return "#ef4444";
    if (s >= 40) return "#f59e0b";
    return "#10b981";
  };

  const ringColor = color === "auto" ? getColor(score) : color;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.25,1,0.5,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold score-number" style={{ color: ringColor }}>
            {Math.round(animated)}
          </span>
          <span className="text-xs text-slate-400 mt-0.5">/ 100</span>
        </div>
      </div>
      {label && <p className="text-sm font-semibold text-center" style={{ color: "#220133" }}>{label}</p>}
      {sublabel && <p className="text-xs text-center max-w-[120px] leading-relaxed" style={{ color: "#9988AA" }}>{sublabel}</p>}
    </div>
  );
}
