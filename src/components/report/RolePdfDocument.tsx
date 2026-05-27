import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";

// ── Types (mirrors DashboardView.Analysis) ────────────────────────────────────
interface Task {
  name: string;
  automationScore: number;
  automationPotential: string;
  category?: string;
  aiOpportunity?: string;
}

interface Opportunity {
  title: string;
  description: string;
  impact: string;
  effort: string;
  tools?: string[];
  estimatedTimeSaving?: string;
}

interface RoadmapPhase {
  phase: string;
  timeline: string;
  items: string[];
}

export interface PdfAnalysis {
  jobTitle: string;
  department?: string;
  executiveSummary?: string;
  overallAutomationScore: number;
  aiReadinessScore?: number;
  estimatedHoursSavedPerWeek?: number;
  tasks?: Task[];
  aiOpportunities?: Opportunity[];
  skillsAnalysis?: { futureProof?: string[]; atRisk?: string[]; aiAugmented?: string[] };
  implementationRoadmap?: RoadmapPhase[];
  roiHighlights?: { focusShift?: string; productivity_multiplier?: string };
}

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  brand:    "#FD5A0F",
  dark:     "#220133",
  purple:   "#553366",
  muted:    "#9988AA",
  border:   "#EAE4EF",
  bg:       "#F4EFF6",
  white:    "#FFFFFF",
  red:      "#ef4444",
  amber:    "#f59e0b",
  green:    "#059669",
  redBg:    "#fef2f2",
  amberBg:  "#fffbeb",
  greenBg:  "#ecfdf5",
};

function scoreColor(s: number) {
  return s >= 65 ? C.red : s >= 40 ? C.amber : C.green;
}
function potLabel(s: number) {
  return s >= 65 ? "High" : s >= 40 ? "Medium" : "Low";
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:          { fontFamily: "Helvetica", backgroundColor: C.white, paddingBottom: 36 },

  // Header
  header:        { backgroundColor: C.dark, padding: "24 32 20", marginBottom: 0 },
  headerLabel:   { fontSize: 7, color: C.brand, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 },
  headerTitle:   { fontSize: 20, color: C.white, fontFamily: "Helvetica-Bold", letterSpacing: -0.5, marginBottom: 4 },
  headerSub:     { fontSize: 9, color: "#C4B5D0" },
  headerRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  headerMeta:    { fontSize: 8, color: "#C4B5D0", textAlign: "right" },

  // Score chips
  kpiRow:        { flexDirection: "row", gap: 10, padding: "16 32 0" },
  kpiBox:        { flex: 1, borderRadius: 10, padding: "12 14", border: "1px solid #EAE4EF" },
  kpiValue:      { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  kpiLabel:      { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 },

  // Section
  section:       { padding: "18 32 0" },
  sectionTitle:  { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.dark, textTransform: "uppercase",
                   letterSpacing: 1, marginBottom: 10, paddingBottom: 6,
                   borderBottom: `1px solid ${C.border}` },
  body:          { fontSize: 9, color: C.purple, lineHeight: 1.6 },

  // Task rows
  taskRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6,
                   padding: "8 10", borderRadius: 8, backgroundColor: C.bg },
  taskScore:     { fontSize: 11, fontFamily: "Helvetica-Bold", width: 32, textAlign: "right" },
  taskName:      { flex: 1, fontSize: 8, color: C.dark },
  taskPot:       { fontSize: 7, fontFamily: "Helvetica-Bold", padding: "2 6", borderRadius: 10 },
  taskBar:       { height: 3, borderRadius: 2, marginTop: 4 },

  // Opportunity card
  oppCard:       { borderRadius: 8, border: `1px solid ${C.border}`, padding: "10 12", marginBottom: 8 },
  oppTitle:      { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.dark, marginBottom: 4 },
  oppDesc:       { fontSize: 8, color: C.purple, lineHeight: 1.5, marginBottom: 6 },
  oppTagRow:     { flexDirection: "row", gap: 6 },
  oppTag:        { fontSize: 7, padding: "2 7", borderRadius: 8, fontFamily: "Helvetica-Bold" },

  // Skills
  skillsGrid:    { flexDirection: "row", gap: 10 },
  skillCol:      { flex: 1, borderRadius: 8, padding: "10 12" },
  skillColTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  skillChip:     { fontSize: 7, color: C.dark, backgroundColor: C.white, borderRadius: 6,
                   padding: "3 7", marginBottom: 4, border: `1px solid ${C.border}` },

  // Roadmap
  phaseRow:      { flexDirection: "row", gap: 10, marginBottom: 8 },
  phaseDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand, marginTop: 2, flexShrink: 0 },
  phaseLabel:    { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.dark, marginBottom: 2 },
  phaseTime:     { fontSize: 7, color: C.muted, marginBottom: 4 },
  phaseItem:     { fontSize: 7, color: C.purple, marginBottom: 2, paddingLeft: 8 },

  // Footer
  footer:        { position: "absolute", bottom: 14, left: 32, right: 32,
                   flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText:    { fontSize: 7, color: C.muted },
  pageNum:       { fontSize: 7, color: C.muted },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function Footer({ company, title }: { company: string; title: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{company} · {title} · AI Automation Report by iMocha</Text>
      <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────
export default function RolePdfDocument({
  company,
  analysis,
  generatedAt,
}: {
  company:     string;
  analysis:    PdfAnalysis;
  generatedAt: string;
}) {
  const score     = analysis.overallAutomationScore;
  const scoreCol  = scoreColor(score);
  const tasks     = analysis.tasks ?? [];
  const sorted    = [...tasks].sort((a, b) => b.automationScore - a.automationScore);
  const opps      = analysis.aiOpportunities ?? [];
  const skills    = analysis.skillsAnalysis ?? {};
  const roadmap   = analysis.implementationRoadmap ?? [];

  const impactCfg = (lvl: string) => {
    if (lvl === "high")   return { text: C.red,   bg: C.redBg };
    if (lvl === "medium") return { text: C.amber, bg: C.amberBg };
    return                       { text: C.green, bg: C.greenBg };
  };

  return (
    <Document title={`${analysis.jobTitle} – ${company} | AI Automation Report`} author="iMocha">

      {/* ── PAGE 1: Header + KPIs + Summary + Tasks ── */}
      <Page size="A4" style={s.page}>
        <Footer company={company} title={analysis.jobTitle} />

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerLabel}>AI Automation Index · Powered by iMocha</Text>
              <Text style={s.headerTitle}>{analysis.jobTitle}</Text>
              <Text style={s.headerSub}>{company}{analysis.department ? ` · ${analysis.department}` : ""}</Text>
            </View>
            <View>
              <Text style={s.headerMeta}>Generated {generatedAt}</Text>
              <Text style={s.headerMeta}>imocha.io</Text>
            </View>
          </View>
        </View>

        {/* KPI chips */}
        <View style={s.kpiRow}>
          <View style={[s.kpiBox, { backgroundColor: scoreCol + "14", borderColor: scoreCol + "44" }]}>
            <Text style={[s.kpiValue, { color: scoreCol }]}>{score}%</Text>
            <Text style={s.kpiLabel}>Automation Score</Text>
          </View>
          {analysis.estimatedHoursSavedPerWeek != null && (
            <View style={[s.kpiBox, { backgroundColor: C.greenBg, borderColor: C.green + "44" }]}>
              <Text style={[s.kpiValue, { color: C.green }]}>{analysis.estimatedHoursSavedPerWeek}h</Text>
              <Text style={s.kpiLabel}>Hours Saved / Week</Text>
            </View>
          )}
          {analysis.aiReadinessScore != null && (
            <View style={[s.kpiBox, { backgroundColor: "#EFF6FF", borderColor: "#93C5FD" }]}>
              <Text style={[s.kpiValue, { color: "#2563EB" }]}>{analysis.aiReadinessScore}%</Text>
              <Text style={s.kpiLabel}>AI Readiness Score</Text>
            </View>
          )}
          <View style={[s.kpiBox, { backgroundColor: scoreCol + "14", borderColor: scoreCol + "44" }]}>
            <Text style={[s.kpiValue, { color: scoreCol }]}>{potLabel(score)}</Text>
            <Text style={s.kpiLabel}>Automation Potential</Text>
          </View>
        </View>

        {/* Executive Summary */}
        {analysis.executiveSummary && (
          <View style={s.section}>
            <SectionTitle>Executive Summary</SectionTitle>
            <Text style={s.body}>{analysis.executiveSummary}</Text>
          </View>
        )}

        {/* ROI */}
        {analysis.roiHighlights && (
          <View style={s.section}>
            <SectionTitle>ROI Highlights</SectionTitle>
            {analysis.roiHighlights.productivity_multiplier && (
              <Text style={s.body}>Productivity Multiplier: {analysis.roiHighlights.productivity_multiplier}</Text>
            )}
            {analysis.roiHighlights.focusShift && (
              <Text style={[s.body, { marginTop: 4 }]}>{analysis.roiHighlights.focusShift}</Text>
            )}
          </View>
        )}

        {/* Task breakdown */}
        {sorted.length > 0 && (
          <View style={s.section}>
            <SectionTitle>{`Task Automation Breakdown (${sorted.length} tasks)`}</SectionTitle>
            {sorted.map((t, i) => {
              const tc  = scoreColor(t.automationScore);
              const pot = impactCfg(t.automationPotential);
              return (
                <View key={i} style={s.taskRow} wrap={false}>
                  <Text style={[s.taskScore, { color: tc }]}>{t.automationScore}%</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.taskName}>{t.name}</Text>
                    <View style={[s.taskBar, { width: `${t.automationScore}%`, backgroundColor: tc }]} />
                    {t.aiOpportunity && (
                      <Text style={[s.body, { fontSize: 7, marginTop: 3, color: C.muted }]}>→ {t.aiOpportunity}</Text>
                    )}
                  </View>
                  <Text style={[s.taskPot, { color: pot.text, backgroundColor: pot.bg }]}>
                    {t.automationPotential.toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Page>

      {/* ── PAGE 2: AI Opportunities + Skills + Roadmap ── */}
      {(opps.length > 0 || Object.keys(skills).length > 0 || roadmap.length > 0) && (
        <Page size="A4" style={s.page}>
          <Footer company={company} title={analysis.jobTitle} />

          {/* Opportunities */}
          {opps.length > 0 && (
            <View style={[s.section, { paddingTop: 28 }]}>
              <SectionTitle>AI Opportunities</SectionTitle>
              {opps.map((o, i) => {
                const ic = impactCfg(o.impact ?? "low");
                const ec = impactCfg(o.effort  ?? "low");
                return (
                  <View key={i} style={s.oppCard} wrap={false}>
                    <Text style={s.oppTitle}>{o.title}</Text>
                    <Text style={s.oppDesc}>{o.description}</Text>
                    <View style={s.oppTagRow}>
                      <Text style={[s.oppTag, { color: ic.text, backgroundColor: ic.bg }]}>
                        Impact: {o.impact?.toUpperCase()}
                      </Text>
                      <Text style={[s.oppTag, { color: ec.text, backgroundColor: ec.bg }]}>
                        Effort: {o.effort?.toUpperCase()}
                      </Text>
                      {o.estimatedTimeSaving && (
                        <Text style={[s.oppTag, { color: C.purple, backgroundColor: C.bg }]}>
                          ⏱ {o.estimatedTimeSaving}
                        </Text>
                      )}
                    </View>
                    {o.tools && o.tools.length > 0 && (
                      <Text style={[s.body, { fontSize: 7, marginTop: 6, color: C.muted }]}>
                        Tools: {o.tools.join(", ")}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Skills */}
          {(skills.futureProof?.length || skills.atRisk?.length || skills.aiAugmented?.length) && (
            <View style={s.section}>
              <SectionTitle>Skills Analysis</SectionTitle>
              <View style={s.skillsGrid}>
                {skills.futureProof?.length ? (
                  <View style={[s.skillCol, { backgroundColor: C.greenBg }]}>
                    <Text style={[s.skillColTitle, { color: C.green }]}>Future-Proof</Text>
                    {skills.futureProof.map((sk, i) => <Text key={i} style={s.skillChip}>{sk}</Text>)}
                  </View>
                ) : null}
                {skills.atRisk?.length ? (
                  <View style={[s.skillCol, { backgroundColor: C.redBg }]}>
                    <Text style={[s.skillColTitle, { color: C.red }]}>At Risk</Text>
                    {skills.atRisk.map((sk, i) => <Text key={i} style={s.skillChip}>{sk}</Text>)}
                  </View>
                ) : null}
                {skills.aiAugmented?.length ? (
                  <View style={[s.skillCol, { backgroundColor: C.amberBg }]}>
                    <Text style={[s.skillColTitle, { color: C.amber }]}>AI-Augmented</Text>
                    {skills.aiAugmented.map((sk, i) => <Text key={i} style={s.skillChip}>{sk}</Text>)}
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* Roadmap */}
          {roadmap.length > 0 && (
            <View style={s.section}>
              <SectionTitle>Implementation Roadmap</SectionTitle>
              {roadmap.map((ph, i) => (
                <View key={i} style={s.phaseRow} wrap={false}>
                  <View style={s.phaseDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.phaseLabel}>{ph.phase}</Text>
                    <Text style={s.phaseTime}>{ph.timeline}</Text>
                    {ph.items.map((it, j) => (
                      <Text key={j} style={s.phaseItem}>• {it}</Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Disclaimer */}
          <View style={[s.section, { marginTop: 16 }]}>
            <Text style={[s.body, { fontSize: 7, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 10 }]}>
              Results are indicative and based on AI analysis of the job description. Powered by iMocha · imocha.io
            </Text>
          </View>
        </Page>
      )}
    </Document>
  );
}
