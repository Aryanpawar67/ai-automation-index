import type { FinalAnalysis } from "@/app/api/analyze/agents/types";

export interface WizardRole {
  analysisId:                 string;
  jobTitle:                   string;
  department:                 string;
  overallAutomationScore:     number;
  aiReadinessScore:           number;
  estimatedHoursSavedPerWeek: number;
  executiveSummary:           string;
  skillsAnalysis: {
    futureProof:  string[];
    atRisk:       string[];
    aiAugmented:  string[];
  };
  automationByCategory: { category: string; score: number }[];
  tasks: {
    name:                string;
    automationScore:     number;
    automationPotential: "high" | "medium" | "low";
    category:            string;
    aiOpportunity:       string;
    scoringRationale?:   string;
  }[];
  aiOpportunities: {
    title:               string;
    description:         string;
    impact:              "high" | "medium" | "low";
    effort:              "high" | "medium" | "low";
    tools:               string[];
    estimatedTimeSaving: string;
  }[];
}

export interface CompanyWizardData {
  analysisType:                "complete" | "standard";
  totalRolesAnalyzed:          number;
  functionsRepresented:        number;
  aiImplementationOpportunity: number;
  taskAutomationPotential:     number;
  workforceUpskillingNeeds:    number;
  totalHoursSavedPerWeek:      number;
  transformationOpportunity:   number;
  humanAiPartnership:          number;
  departmentRadar: { department: string; score: number }[];
  peerBaseline:    { department: string; score: number }[];
  roles:           WizardRole[];
}

const CLUSTERS: { label: string; keywords: string[] }[] = [
  { label: "Operations",    keywords: ["operat", "claims", "service", "support", "contact", "branch", "delivery", "fulfil", "logistics", "supply", "procurement"] },
  { label: "Technology",    keywords: ["tech", "data", "engineer", "software", "digital", "analyt", "architect", "cloud", "infrastructure", "ai ", "ml ", "machine learn", "platform", "devops", "cyber", "it "] },
  { label: "Finance",       keywords: ["financ", "account", "actuari", "treasury", "audit", "controller", "fp&a", "budget", "tax", "invest"] },
  { label: "Sales & Growth",keywords: ["sales", "market", "business develop", "distribut", "partner", "revenue", "growth", "commerc", "brand", "customer success", "client"] },
  { label: "Risk & Legal",  keywords: ["risk", "legal", "complian", "regulat", "govern", "secur", "privacy", "audit", "fraud", "counsel"] },
  { label: "People & Admin",keywords: ["hr", "human resource", "recruit", "talent", "people", "admin", "facilit", "workplace", "culture", "learning", "l&d", "training"] },
];

export function mapToCluster(dept: string): string {
  const d = dept.toLowerCase();
  for (const c of CLUSTERS) {
    if (c.keywords.some(k => d.includes(k))) return c.label;
  }
  return "Operations"; // fallback to most common
}

function seededRand(seed: string, index: number): number {
  let h = 5381;
  const key = seed + ":" + index;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return h / 0xffffffff;
}

export function computeWizardData(
  inputs: { analysisId: string; result: FinalAnalysis; department: string | null }[],
  seed = "default",
  isComplete = false,
): CompanyWizardData {
  if (inputs.length === 0) {
    return {
      analysisType: isComplete ? "complete" : "standard",
      totalRolesAnalyzed: 0,
      functionsRepresented: 0,
      aiImplementationOpportunity: 0,
      taskAutomationPotential: 0,
      workforceUpskillingNeeds: 0,
      totalHoursSavedPerWeek: 0,
      transformationOpportunity: 0,
      humanAiPartnership: 100,
      departmentRadar: [],
      peerBaseline: [],
      roles: [],
    };
  }

  // Build roles array
  const roles: WizardRole[] = inputs.map(({ analysisId, result, department }) => ({
    analysisId,
    jobTitle:                   result.jobTitle,
    department:                 department ?? result.department ?? "Other",
    overallAutomationScore:     result.overallAutomationScore,
    aiReadinessScore:           result.aiReadinessScore,
    estimatedHoursSavedPerWeek: result.estimatedHoursSavedPerWeek,
    executiveSummary:           result.executiveSummary ?? "",
    skillsAnalysis: {
      futureProof:  result.skillsAnalysis?.futureProof  ?? [],
      atRisk:       result.skillsAnalysis?.atRisk       ?? [],
      aiAugmented:  result.skillsAnalysis?.aiAugmented  ?? [],
    },
    automationByCategory: result.automationByCategory ?? [],
    tasks: (result.tasks ?? []).map(t => ({
      name:                t.name,
      automationScore:     t.automationScore,
      automationPotential: t.automationPotential,
      category:            t.category,
      aiOpportunity:       t.aiOpportunity,
      scoringRationale:    (t as { scoringRationale?: string }).scoringRationale,
    })),
    aiOpportunities: (result.aiOpportunities ?? []).map(o => ({
      title:               o.title,
      description:         o.description,
      impact:              o.impact,
      effort:              o.effort,
      tools:               o.tools ?? [],
      estimatedTimeSaving: o.estimatedTimeSaving,
    })),
  }));

  // Sort roles by overallAutomationScore desc
  roles.sort((a, b) => b.overallAutomationScore - a.overallAutomationScore);

  const total = roles.length;

  // aiImplementationOpportunity = avg(aiReadinessScore)
  const aiImplementationOpportunity = Math.round(
    roles.reduce((s, r) => s + r.aiReadinessScore, 0) / total
  );

  // taskAutomationPotential = % tasks with high/medium potential
  const allTasks = roles.flatMap(r => r.tasks);
  const eligibleTasks = allTasks.filter(
    t => t.automationPotential === "high" || t.automationPotential === "medium"
  );
  const taskAutomationPotential = allTasks.length > 0
    ? Math.round((eligibleTasks.length / allTasks.length) * 100)
    : 0;

  // workforceUpskillingNeeds = (atRisk + aiAugmented) / all skills
  let atRiskTotal = 0, aiAugTotal = 0, futureProofTotal = 0;
  for (const r of roles) {
    atRiskTotal    += r.skillsAnalysis.atRisk.length;
    aiAugTotal     += r.skillsAnalysis.aiAugmented.length;
    futureProofTotal += r.skillsAnalysis.futureProof.length;
  }
  const allSkills = atRiskTotal + aiAugTotal + futureProofTotal;
  const workforceUpskillingNeeds = allSkills > 0
    ? Math.round(((atRiskTotal + aiAugTotal) / allSkills) * 100)
    : 0;

  // totalHoursSavedPerWeek
  const totalHoursSavedPerWeek = Math.round(
    roles.reduce((s, r) => s + r.estimatedHoursSavedPerWeek, 0)
  );

  // transformationOpportunity = % roles with overallAutomationScore >= 50
  const transformationOpportunity = Math.round(
    (roles.filter(r => r.overallAutomationScore >= 50).length / total) * 100
  );
  const humanAiPartnership = 100 - transformationOpportunity;

  // departmentRadar: map every role to one of 6 universal function clusters
  const clusterMap = new Map<string, number[]>();
  for (const c of CLUSTERS) clusterMap.set(c.label, []);
  for (const r of roles) {
    const label = mapToCluster(r.department);
    clusterMap.get(label)!.push(r.overallAutomationScore);
  }

  // Industry baseline score used for clusters with no roles (~55 = avg AI readiness)
  const BASELINE_SCORE = 55;
  const departmentRadar = CLUSTERS.map((c, i) => {
    const scores = clusterMap.get(c.label)!;
    const score  = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : Math.round(BASELINE_SCORE + (seededRand(seed, i + 100) * 10 - 5));
    return { department: c.label, score };
  });

  // peerBaseline: fixed industry anchors steer direction, offset clamped to ±10 of company score
  const INDUSTRY_ANCHORS: Record<string, number> = {
    "Operations":    54,
    "Technology":    64,
    "Finance":       57,
    "Sales & Growth":60,
    "Risk & Legal":  51,
    "People & Admin":53,
  };
  const peerBaseline = departmentRadar.map(d => {
    const anchor    = INDUSTRY_ANCHORS[d.department] ?? 55;
    const direction = anchor - d.score;
    const offset    = Math.max(-10, Math.min(10, direction));
    return {
      department: d.department,
      score:      Math.round(d.score + offset),
    };
  });

  const functionsRepresented = CLUSTERS.filter(
    c => (clusterMap.get(c.label)?.length ?? 0) > 0
  ).length;

  return {
    analysisType: isComplete ? "complete" : "standard",
    totalRolesAnalyzed: total,
    functionsRepresented,
    aiImplementationOpportunity,
    taskAutomationPotential,
    workforceUpskillingNeeds,
    totalHoursSavedPerWeek,
    transformationOpportunity,
    humanAiPartnership,
    departmentRadar,
    peerBaseline,
    roles,
  };
}
