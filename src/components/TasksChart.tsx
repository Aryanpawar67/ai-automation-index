"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Task {
  name: string;
  automationScore: number;
  automationPotential: "high" | "medium" | "low";
  category: string;
  aiOpportunity: string;
}

interface Props { tasks: Task[] }

const getBarColor = (score: number) => {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#10b981";
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: Task }> }) => {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  return (
    <div className="card p-3 text-xs max-w-[220px]" style={{ background: "#fff", border: "1px solid #e4e7ef", boxShadow: "0 4px 16px rgba(15,23,42,0.1)" }}>
      <p className="text-slate-800 font-semibold mb-1">{t.name}</p>
      <p className="text-slate-400 mb-1">Category: {t.category}</p>
      <p style={{ color: "#FD5A0F" }}>{t.aiOpportunity}</p>
    </div>
  );
};

const truncateLabel = (value: string) => value.length > 24 ? value.slice(0, 22) + "…" : value;

export default function TasksChart({ tasks }: Props) {
  const sorted = [...tasks].sort((a, b) => b.automationScore - a.automationScore);
  const chartHeight = Math.max(300, sorted.length * 46);
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={185}
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={truncateLabel}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(109,40,217,0.04)" }} />
        <Bar dataKey="automationScore" radius={[0, 6, 6, 0]} barSize={18}>
          {sorted.map((task, i) => (
            <Cell key={i} fill={getBarColor(task.automationScore)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
