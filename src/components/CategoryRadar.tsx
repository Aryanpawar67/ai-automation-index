"use client";

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

interface CategoryData { category: string; score: number }
interface Props { data: CategoryData[] }

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: CategoryData }> }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-2.5 text-xs" style={{ background: "#fff", border: "1px solid #e4e7ef", boxShadow: "0 4px 16px rgba(15,23,42,0.1)" }}>
      <p className="text-slate-800 font-semibold">{payload[0].payload.category}</p>
      <p style={{ color: "#FD5A0F" }}>{payload[0].value}% automatable</p>
    </div>
  );
};

export default function CategoryRadar({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
        <PolarGrid stroke="#e4e7ef" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: "#553366", fontSize: 11 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Radar
          dataKey="score"
          stroke="#FD5A0F"
          fill="#FD5A0F"
          fillOpacity={0.18}
          strokeWidth={2}
          dot={{ fill: "#FF8C4B", r: 3 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
