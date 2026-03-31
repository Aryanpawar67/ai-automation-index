// ─── Agent Input / Output Types ──────────────────────────────────────────────

export interface ParsedJD {
  jobTitle: string;
  department: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "executive";
  responsibilities: string[];
  requiredSkills: string[];
  toolsMentioned: string[];
  industryContext: string;
  teamContext: string;
}

export type TaskCategory =
  | "Data Processing"
  | "Communication"
  | "Research"
  | "Reporting"
  | "Creative"
  | "Strategic"
  | "Administrative"
  | "Technical";

export interface RawTask {
  name: string;
  description: string;
  category: TaskCategory;
  estimatedTimeShare: number; // 0–1, fraction of a 40h week
}

export interface ScoredTask extends RawTask {
  automationScore: number;           // 0–100 per calibration scale
  automationPotential: "high" | "medium" | "low";
  scoringRationale: string;          // why this score was given
  aiOpportunity: string;             // specific AI tool for this task
}

export interface SkillsAnalysis {
  futureProof: string[];
  atRisk: string[];
  aiAugmented: string[];
}

export interface ROIData {
  estimatedHoursSavedPerWeek: number;
  productivity_multiplier: string;   // "Nx" format
  focusShift: string;
  formula: string;                   // human-readable calculation for CFO
}

export interface Opportunity {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  tools: string[];
  estimatedTimeSaving: string;
}

export interface RoadmapPhase {
  phase: string;
  timeline: string;
  items: string[];
}

// ─── Final Output (dashboard-compatible) ─────────────────────────────────────

export interface FinalAnalysis {
  jobTitle: string;
  department: string;
  executiveSummary: string;
  overallAutomationScore: number;
  aiReadinessScore: number;
  estimatedHoursSavedPerWeek: number;
  tasks: Array<{
    name: string;
    automationScore: number;
    automationPotential: "high" | "medium" | "low";
    category: string;
    aiOpportunity: string;
    scoringRationale: string;
  }>;
  aiOpportunities: Opportunity[];
  skillsAnalysis: SkillsAnalysis;
  automationByCategory: Array<{ category: string; score: number }>;
  implementationRoadmap: RoadmapPhase[];
  roiHighlights: {
    focusShift: string;
    productivity_multiplier: string;
    formula: string;
  };
}

// ─── SSE Event Types ─────────────────────────────────────────────────────────

export type AgentName =
  | "Job Description Analyser"
  | "Task Decomposer"
  | "Task Scoring + Tools Research + Skills Analysis"
  | "ROI Calculator"
  | "Opportunity Synthesizer"
  | "Roadmap Builder"
  | "Finalising Analysis";

export interface SSEEvent {
  type: "agent_complete" | "complete" | "error";
  agent?: AgentName;
  step?: number;
  totalSteps: number;
  data?: Partial<FinalAnalysis>;
  result?: FinalAnalysis;
  message?: string;
}
