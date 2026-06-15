"use client";

import { useEffect, useRef } from "react";

interface Props {
  labels:  string[];
  company: number[];
  peers:   number[];
}

export default function WizardRadarChart({ labels, company, peers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || labels.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W  = canvas.width;
    const H  = canvas.height;
    const cx = W / 2;
    const cy = H / 2 + 10;
    const R  = Math.min(W, H) * 0.36;
    const N  = labels.length;
    const step = (2 * Math.PI) / N;

    ctx.clearRect(0, 0, W, H);

    function pt(i: number, v: number) {
      const a = step * i - Math.PI / 2;
      const r = (v / 100) * R;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }

    // Grid rings
    [20, 40, 60, 80, 100].forEach(v => {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const p = pt(i, v);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth   = 1;
      ctx.stroke();
    });

    // Spokes
    for (let i = 0; i < N; i++) {
      const p = pt(i, 100);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // Peers polygon
    ctx.beginPath();
    peers.forEach((v, i) => {
      const p = pt(i, v);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle   = "rgba(74,222,128,0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(74,222,128,0.5)";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Company polygon
    ctx.beginPath();
    company.forEach((v, i) => {
      const p = pt(i, v);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle   = "rgba(253,90,15,0.18)";
    ctx.fill();
    ctx.strokeStyle = "#FD5A0F";
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Company dots
    company.forEach((v, i) => {
      const p = pt(i, v);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#FD5A0F";
      ctx.fill();
    });

    // Labels at 118% radius
    ctx.font         = "600 12px -apple-system,BlinkMacSystemFont,sans-serif";
    ctx.fillStyle    = "rgba(255,255,255,0.65)";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    labels.forEach((l, i) => {
      const p = pt(i, 118);
      ctx.fillText(l, p.x, p.y);
    });
  }, [labels, company, peers]);

  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      <canvas ref={canvasRef} width={420} height={380} style={{ width: "100%", height: "auto" }} />
    </div>
  );
}
