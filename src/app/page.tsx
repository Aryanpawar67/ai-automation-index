"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_JD = `Job Title: Senior Marketing Manager

We are looking for an experienced Senior Marketing Manager to lead our B2B marketing efforts.

Key Responsibilities:
- Develop and execute comprehensive marketing strategies across digital and traditional channels
- Create and manage content calendar including blog posts, whitepapers, and case studies
- Analyze marketing performance data and generate weekly/monthly reports for leadership
- Manage and optimize paid advertising campaigns (Google Ads, LinkedIn, Meta)
- Coordinate with sales team to align on lead generation goals and nurture campaigns
- Conduct market research and competitive analysis to identify new opportunities
- Manage email marketing campaigns including segmentation, A/B testing, and optimization
- Oversee social media presence and engagement across LinkedIn, Twitter, and Instagram
- Collaborate with design team to produce marketing collateral
- Manage vendor relationships and marketing technology stack
- Present quarterly business reviews to C-suite

Requirements:
- 5+ years of B2B marketing experience
- Proficiency in Salesforce, HubSpot, and Google Analytics
- Strong data analysis and reporting skills
- Experience with SEO/SEM strategies
- Budget management experience ($500K+ annual budget)`;

const FEATURES = [
  { icon: "⚡", label: "Automation Score" },
  { icon: "📋", label: "Task Breakdown" },
  { icon: "🤖", label: "AI Tools Mapping" },
  { icon: "🎯", label: "Skills Analysis" },
  { icon: "💡", label: "ROI Estimate" },
];

// The 7 pipeline steps shown in the progress UI
const PIPELINE_STEPS = [
  { key: "Job Description Analyser",                              shortLabel: "JD Analyser",          label: "Extracting role structure & skills",      icon: "📄" },
  { key: "Task Decomposer",                                       shortLabel: "Task Decomposer",       label: "Mapping tasks & time distribution",        icon: "🗂️" },
  { key: "Task Scoring + Tools Research + Skills Analysis",       shortLabel: "Parallel Analysis",     label: "Scoring · tools · skills — in parallel",   icon: "⚡" },
  { key: "ROI Calculator",                                        shortLabel: "ROI Calculator",        label: "Computing hours saved & productivity",     icon: "📊" },
  { key: "Opportunity Synthesizer",                               shortLabel: "Opportunities",         label: "Identifying highest-impact AI wins",       icon: "💡" },
  { key: "Roadmap Builder",                                       shortLabel: "Roadmap Builder",       label: "Sequencing phased implementation plan",    icon: "🗺️" },
  { key: "Finalising Analysis",                                   shortLabel: "Finalising",            label: "Assembling your complete report",          icon: "✅" },
];

type StepStatus = "pending" | "running" | "complete";

interface AgentEvent {
  type: "agent_complete" | "complete" | "error";
  agent?: string;
  step?: number;
  totalSteps?: number;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
  message?: string;
}

function IMochaIcon({ size = 28, color = "#FD5A0F" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 51 51" fill="none">
      <path d="M50.085 20.368C49.736 18.111 48.861 15.855 47.812 13.772C46.762 14.466 45.538 14.813 44.139 14.813C40.29 14.813 37.142 11.689 37.142 7.871C37.142 6.308 37.667 4.92 38.541 3.705C35.743 1.969 32.769 0.754 29.446 0.06C28.046 -0.287 26.822 0.928 26.822 2.316V8.218C26.822 9.259 27.522 10.3 28.571 10.474C33.819 11.863 38.017 15.855 39.416 21.062C39.766 22.103 40.64 22.798 41.69 22.798H47.637C49.211 23.145 50.435 21.756 50.085 20.368Z" fill={color}/>
      <path d="M10.73 21.409C12.129 16.202 16.327 12.036 21.575 10.821C22.624 10.474 23.324 9.606 23.324 8.565V2.49C23.324 1.101 21.925 -0.114 20.7 0.234C10.205 2.143 1.984 10.127 0.06 20.368C-0.289 21.756 0.935 23.145 2.334 23.145H8.456C9.506 23.145 10.555 22.277 10.73 21.409Z" fill={color}/>
      <path d="M21.575 39.46C16.327 38.072 12.129 34.08 10.73 28.873C10.38 27.831 9.506 27.137 8.456 27.137H2.334C0.935 27.137 -0.289 28.525 0.06 29.914C1.984 40.154 10.205 48.139 20.525 50.048C21.925 50.395 23.149 49.18 23.149 47.792V41.89C23.324 40.502 22.624 39.634 21.575 39.46Z" fill={color}/>
      <path d="M39.591 28.699C38.192 33.906 33.994 37.898 28.746 39.287C27.697 39.634 26.997 40.502 26.997 41.543V47.444C26.997 48.833 28.396 50.048 29.621 49.701C39.941 47.792 48.162 39.807 50.086 29.567C50.436 28.178 49.211 26.79 47.812 26.79H41.69C40.64 26.963 39.766 27.658 39.591 28.699Z" fill={color}/>
      <path d="M44.314 1.101C42.04 1.101 40.116 2.143 38.891 3.705C42.739 6.135 45.888 9.606 47.987 13.772C49.911 12.557 51.31 10.301 51.31 7.871C51.31 4.226 48.162 1.101 44.314 1.101Z" fill={color}/>
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [error, setError] = useState("");

  // Progress state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [currentAgent, setCurrentAgent] = useState("");
  const [stepData, setStepData] = useState<Record<string, string>>({});
  const [completedSteps, setCompletedSteps] = useState(0);

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) { setError("Please paste a job description to analyze."); return; }
    setError("");
    setIsAnalyzing(true);
    setStepStatuses({});
    setStepData({});
    setCompletedSteps(0);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, company }),
      });

      if (!res.ok || !res.body) throw new Error("Analysis request failed.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let activeAgent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: AgentEvent = JSON.parse(line.slice(6));

            if (event.type === "error") {
              setError(event.message ?? "Analysis failed.");
              setIsAnalyzing(false);
              setStepStatuses({});
              setStepData({});
              setCompletedSteps(0);
              return;
            }

            if (event.type === "agent_complete" && event.agent) {
              // Mark previous agent as complete, current as running
              if (activeAgent) {
                setStepStatuses(prev => ({ ...prev, [activeAgent]: "complete" }));
              }
              activeAgent = event.agent;
              setCurrentAgent(event.agent);
              setStepStatuses(prev => ({ ...prev, [event.agent!]: "running" }));
              setCompletedSteps(event.step ?? 0);

              // Show a snippet of what this agent found
              if (event.data) {
                const snippet = formatSnippet(event.agent, event.data);
                if (snippet) setStepData(prev => ({ ...prev, [event.agent!]: snippet }));
              }
            }

            if (event.type === "complete" && event.result) {
              // Mark last agent complete
              if (activeAgent) {
                setStepStatuses(prev => ({ ...prev, [activeAgent]: "complete" }));
              }
              setStepStatuses(prev => ({ ...prev, ["Finalising Analysis"]: "complete" }));
              setCompletedSteps(7);

              sessionStorage.setItem("analysisResult", JSON.stringify(event.result));
              sessionStorage.setItem("company", company);
              // Brief pause so user sees the completed state
              setTimeout(() => router.push("/dashboard"), 600);
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsAnalyzing(false);
      setStepStatuses({});
      setStepData({});
      setCompletedSteps(0);
    }
  };

  const progressPct = Math.round((completedSteps / 7) * 100);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #FFF8F5 0%, #FFFFFF 50%, #F9F7FB 100%)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #FD5A0F, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #220133, transparent 70%)" }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-4" style={{ borderBottom: "1px solid #EAE4EF", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2.5">
          <IMochaIcon size={28} color="#FD5A0F" />
          <span className="font-bold text-base tracking-tight" style={{ color: "#220133" }}>iMocha</span>
          <span style={{ color: "#D0C8D8", fontSize: "18px", margin: "0 2px" }}>|</span>
          <span className="font-medium text-sm" style={{ color: "#553366" }}>AI Automation Index</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "#9988AA" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Powered by Claude
        </div>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">

        {/* ── Analyzing State: Live Multi-Agent Progress ── */}
        {isAnalyzing ? (
          <div className="max-w-xl w-full mx-auto animate-fade-in">

            {/* Animated header */}
            <div className="text-center mb-7">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl animate-ping opacity-[0.18]" style={{ background: "#FD5A0F" }} />
                <div className="absolute inset-0 rounded-2xl animate-ping opacity-[0.10]" style={{ background: "#FD5A0F", animationDelay: "0.6s" }} />
                <div className="relative w-20 h-20 rounded-2xl gradient-btn flex items-center justify-center" style={{ boxShadow: "0 8px 32px rgba(253,90,15,0.45)" }}>
                  <IMochaIcon size={34} color="#fff" />
                </div>
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "#220133" }}>Multi-Agent System Running</h2>
              <p className="text-sm" style={{ color: "#9988AA" }}>
                {currentAgent ? `Active: ${currentAgent}` : "Initialising pipeline…"}
              </p>
            </div>

            {/* Progress bar with shimmer */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "#9988AA" }}>
                <span>{completedSteps} of 7 agents complete</span>
                <span className="font-bold" style={{ color: "#FD5A0F" }}>{progressPct}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#EAE4EF" }}>
                <div className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                  style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #220133, #FD5A0F)" }}>
                  <div className="absolute inset-0 animate-shimmer"
                    style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)" }} />
                </div>
              </div>
            </div>

            {/* Agent pipeline rows */}
            <div className="space-y-2">
              {PIPELINE_STEPS.map(step => {
                const status: StepStatus = stepStatuses[step.key] ?? "pending";
                const snippet = stepData[step.key];
                const isRunning = status === "running";
                const isDone    = status === "complete";
                return (
                  <div key={step.key}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500"
                    style={{
                      background:  isRunning ? "linear-gradient(135deg,#FFF8F5,#FFF0EA)" : isDone ? "#F0FDF9" : "#FAFAFA",
                      border:     `1px solid ${isRunning ? "#FDBB96" : isDone ? "#6ee7b7" : "#EAE4EF"}`,
                      boxShadow:   isRunning ? "0 4px 20px rgba(253,90,15,0.13)" : "none",
                      transform:   isRunning ? "scale(1.015)" : "scale(1)",
                    }}>

                    {/* Status circle */}
                    <div className="relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: isDone ? "#10b981" : isRunning ? "#FD5A0F" : "#F4EFF6",
                        boxShadow:  isRunning ? "0 0 14px rgba(253,90,15,0.5)" : "none",
                      }}>
                      {isDone ? (
                        <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
                          <path d="M4 8l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : isRunning ? (
                        <span className="text-white text-sm leading-none">{step.icon}</span>
                      ) : (
                        <span className="text-sm leading-none opacity-25">{step.icon}</span>
                      )}
                      {isRunning && (
                        <div className="absolute -inset-1.5 rounded-full border-2 border-orange-400 animate-ping opacity-30" />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold"
                          style={{ color: isDone ? "#059669" : isRunning ? "#220133" : "#9988AA" }}>
                          {step.shortLabel}
                        </span>
                        {isRunning && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background: "#FD5A0F", color: "#fff" }}>
                            Live
                          </span>
                        )}
                        {isDone && snippet && (
                          <span className="text-xs truncate max-w-[180px]" style={{ color: "#059669" }}>{snippet}</span>
                        )}
                      </div>
                      <p className="text-xs truncate"
                        style={{ color: isDone ? "#34d399" : isRunning ? "#9988AA" : "#D0C8D8" }}>
                        {isRunning ? step.label : isDone ? "Done" : step.label}
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs mt-5" style={{ color: "#D0C8D8" }}>
              Traced live in LangSmith · Every agent call is logged
            </p>
          </div>
        ) : (
          /* ── Input State ── */
          <>
            <div className="max-w-2xl w-full mx-auto text-center mb-10 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
                style={{ background: "#FFF0EA", color: "#FD5A0F", border: "1px solid #FDBB96" }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M6 0L7.5 4.5H12L8.25 7.27L9.75 12L6 9.27L2.25 12L3.75 7.27L0 4.5H4.5L6 0Z"/>
                </svg>
                Multi-Agent Analysis
              </div>
              <h1 className="text-5xl sm:text-[56px] font-extrabold mb-5 leading-[1.1] tracking-tight" style={{ color: "#220133" }}>
                Discover AI Opportunities<br />
                <span style={{ background: "linear-gradient(135deg, #FD5A0F, #FF8C4B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  in Any Role
                </span>
              </h1>
              <p className="text-lg max-w-lg mx-auto leading-relaxed" style={{ color: "#553366" }}>
                Paste a job description. Specialized agents analyze it in parallel — each focused on one dimension, traced live in LangSmith.
              </p>
            </div>

            <div className="max-w-2xl w-full mx-auto animate-fade-in-up delay-2">
              <div className="card p-6">
                <div className="mb-4">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#9988AA" }}>
                    Organization Name <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="e.g. Acme Corp, Google, My Startup"
                    className="w-full border rounded-xl px-4 py-3 text-sm placeholder-slate-300 transition-colors"
                    style={{ border: "1px solid #EAE4EF", background: "#FAFAFA", color: "#220133" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#FD5A0F"}
                    onBlur={e => e.currentTarget.style.borderColor = "#EAE4EF"}
                  />
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "#9988AA" }}>Job Description</label>
                    <button onClick={() => setJobDescription(EXAMPLE_JD)} className="text-xs hover:underline underline-offset-2" style={{ color: "#FD5A0F" }}>
                      Load example
                    </button>
                  </div>
                  <textarea
                    value={jobDescription}
                    onChange={e => setJobDescription(e.target.value)}
                    placeholder="Paste the full job description here — responsibilities, requirements, tools used, etc."
                    rows={12}
                    className="w-full border rounded-xl px-4 py-3 text-sm placeholder-slate-300 resize-none leading-relaxed transition-colors"
                    style={{ border: "1px solid #EAE4EF", background: "#FAFAFA", color: "#220133" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#FD5A0F"}
                    onBlur={e => e.currentTarget.style.borderColor = "#EAE4EF"}
                  />
                  <p className="mt-1.5 text-xs" style={{ color: "#D0C8D8" }}>{jobDescription.length} characters</p>
                </div>

                {error && (
                  <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-600" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleAnalyze}
                  className="w-full gradient-btn font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <IMochaIcon size={16} color="#fff" />
                  Analyze with AI Agents
                </button>
              </div>

              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {FEATURES.map(f => (
                  <span key={f.label} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white" style={{ border: "1px solid #EAE4EF", color: "#553366" }}>
                    <span>{f.icon}</span> {f.label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="relative z-10 text-center pb-8 text-xs" style={{ color: "#D0C8D8" }}>
        iMocha AI Automation Index &nbsp;·&nbsp; Multi-Agent Pipeline &nbsp;·&nbsp; Traced with LangSmith
      </footer>
    </div>
  );
}

function formatSnippet(agent: string, data: Record<string, unknown>): string {
  if (agent === "Job Description Analyser" && data.jobTitle) return `→ ${data.jobTitle} · ${data.department}`;
  if (agent === "Task Decomposer" && data.taskCount) return `→ ${data.taskCount} tasks identified`;
  if (agent.startsWith("Task Scoring") && data.topTask) return `→ Highest: ${data.topTask}`;
  if (agent === "ROI Calculator" && data.estimatedHoursSavedPerWeek) return `→ ${data.estimatedHoursSavedPerWeek}h/week reclaimed · ${data.productivity_multiplier} productivity`;
  if (agent === "Opportunity Synthesizer" && data.topOpportunity) return `→ Top: ${data.topOpportunity}`;
  if (agent === "Roadmap Builder") return `→ 3-phase roadmap complete`;
  return "";
}
