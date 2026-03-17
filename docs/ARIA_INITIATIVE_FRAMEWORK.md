# Project ARIA
## AI-Native Reach & Intelligence Activation

**Framework — CEO Sign-Off Brief + Execution Playbook**
*iMocha CEO's Office Initiative · Owner: Growth PM · March 2026*

---

## The Big Bet

Most B2B SaaS companies sell skills intelligence. We will *demonstrate* it — through a portfolio of free, AI-powered tools that let HR leaders experience iMocha's value before a single sales conversation happens. Each tool creates a personalised "aha moment" for a specific persona, captures intent, and feeds a qualified pipeline. The tools do the selling. We build the tools with AI.

**Target:** 5,000 relevant personas experience an iMocha AI tool within 90 days.

---

## The Three Layers

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1 — BUILD                                             │
│  AI-native tool development (1 PM + 1 technical intern)      │
│  Goal: Ship 1 new AI experience every 10 days                │
│  Stack: Claude + LangGraph + Next.js + Vercel                │
├──────────────────────────────────────────────────────────────┤
│  LAYER 2 — REACH                                             │
│  AI-powered distribution to 5,000 personas                   │
│  Goal: Personalised outreach at scale, zero spray-and-pray   │
│  Stack: Clay · Apollo · LinkedIn AI · Claude for copy        │
├──────────────────────────────────────────────────────────────┤
│  LAYER 3 — CONVERT                                           │
│  In-tool lead capture → Sales handoff pipeline               │
│  Goal: Every tool trial becomes a qualified conversation      │
│  Stack: HubSpot · Slack alerts · AI follow-up sequences      │
└──────────────────────────────────────────────────────────────┘
```

---

## The Tool Portfolio — Release Calendar

iMocha's platform runs on **23 specialised agents across 4 layers** — Skills Inference, Skills Validation, Skills Architecture, and Skills Matching. Each tool is a self-serve, public-facing window into one or more of those agents. The persona experiences real platform intelligence. We capture intent. Sales closes the conversation.

**Cadence: 1 tool every 10 days. All 7 tools live by Day 70.**

| Day | Launch Date | Tool | Underlying iMocha Agent(s) | Primary Persona | The "Aha Moment" |
|-----|-------------|------|---------------------------|----------------|-----------------|
| 0 | Mar 7 | **① AI Automation Index** | AI Automation Index Agent *(#16)* | CHRO · HR Head · Workforce Planning | "Every task in this role has a live automation risk score — and a reskilling urgency signal" |
| 10 | Mar 17 | **② Role Redesign Planner** | AI Automation Index + Career Path Agent *(#16, #18)* | Workforce Planning · CHRO | "Here's exactly how this role should split between human and AI — with a phased transition plan" |
| 20 | Mar 27 | **③ Hiring Brief Scorer** | Skill Normalization + AI Automation Index + Hiring Agent *(#14, #16, #21)* | TA Leader · Recruiter | "30% of the skills in this JD will be automated in 3 years — here's what to hire for instead" |
| 30 | Apr 6 | **④ Skills Gap Radar** | Work Data Aggregator + Learning Recommendation Agent *(#6, #19)* | L&D Head | "Here are the exact skill gaps between your team today and what AI-augmented roles require in 2027" |
| 40 | Apr 16 | **⑤ Career Path Intelligence** | Career Path + Learning Recommendation Agent *(#18, #19)* | L&D Head · Employee | "Given your skills and AI trends, here are your 3 highest-probability career paths with a roadmap for each" |
| 50 | Apr 26 | **⑥ Succession Bench Analyser** | TARA + Succession Planning Agent *(#8, #22)* | CHRO · CEO | "For this critical role: who is Ready Now, 1-Year, 3-Year — and what skills close each gap" |
| 60 | May 6 | **⑦ Workforce AI Readiness Score** | Workforce Planning + AI Automation Index Agent *(#23, #16)* | CHRO · CEO · Board | "Your organisation's AI readiness score is X — here are the 5 highest-risk roles and 3 highest-ROI actions" |

> Each tool is **ungated and self-serve** — no login required. One CTA at the end of every result: *"See how iMocha does this across your entire workforce."*

---

## The 5,000 Personas

| Persona | ICP Fit | Tools Available | Reach Channel | Volume |
|---------|---------|----------------|--------------|--------|
| CHRO / VP HR | Primary buyer | ①②⑥⑦ | LinkedIn outreach + HR communities | 1,500 |
| L&D / Talent Development Head | Champion | ④⑤⑦ | L&D Slack groups + newsletter drops | 1,000 |
| Talent Acquisition Leader | Champion | ③① | TA communities + LinkedIn | 1,000 |
| Workforce Planning / People Analytics | Influencer | ①②⑦ | Targeted content syndication | 800 |
| HR Tech Evaluators & Analysts | Amplifier | All 7 | Analyst outreach + G2 / Capterra | 700 |

---

## Outreach Sequencing — How We Message Personas Across Multiple Tools

### The Core Rule: One Tool Per Message. Always.

Sending multiple tool links in one message feels like a product catalogue. We are not cataloguing — we are creating a sequence of personalised insights. Each message leads with a single problem, links to a single tool, and earns the right to send the next message based on what the persona does next.

### The Sequencing Logic

```
                    ┌─────────────────────────────────────────┐
                    │         PERSONA ENTERS SEQUENCE          │
                    │   Enrolled via Clay enrichment + tier    │
                    └──────────────────┬──────────────────────┘
                                       │
                              TOUCH 1 — Tool A
                         (Most relevant to this persona)
                                       │
                    ┌──────────────────┴──────────────────────┐
                    │                                          │
               USED THE TOOL                           DID NOT ENGAGE
          (click + ran analysis)                    (opened or ignored)
                    │                                          │
             Wait 3-5 days                             Wait 10 days
                    │                                          │
           TOUCH 2 — Tool B                         TOUCH 2 — Tool B
       "You found X in Tool A.                  (Different angle, fresh
        Here's the next layer."                  problem framing)
                    │                                          │
                    ├──────────────────────────────────────────┤
                    │                                          │
               USED TOOL B                          DID NOT ENGAGE
                    │                                          │
             Wait 3-5 days                             Wait 10 days
                    │                                          │
           TOUCH 3 — Sales CTA                      TOUCH 3 — Tool C
       "You've seen both X and Y.               (Final tool, last attempt
        20 minutes to show you                  before low-intent flag)
        the full picture?"                                     │
                                                    NO ENGAGEMENT
                                                               │
                                                  Mark low-intent
                                                  Re-enter in 60 days
```

### The Three Sequence Types

**Type A — Engaged Path** *(persona uses a tool)*
Tool used → reference what they found → send next tool as natural follow-on → after 2 tools used → Sales CTA.
Message tone: warm, specific, references their actual output.

**Type B — Cold Path** *(persona opened but didn't run the tool)*
Try different angle → different tool, different problem framing → after 3 touchpoints with no tool usage → low-intent flag.
Message tone: short, sharp, new hook each time.

**Type C — Champion Path** *(persona uses 2+ tools or shares with colleague)*
Auto-trigger Slack alert to AE with enriched profile → AE reaches out within 24h.
This is the highest-intent signal in the system.

---

## Persona Outreach Playbooks

---

### Persona 1 — CHRO / VP HR
*4 tools available: ① → ⑥ → ② → ⑦*
*Priority order: biggest strategic pain first (automation risk), then succession, then redesign, then org-level score*

```
TOUCH 1 — Day 0 — Tool ①: AI Automation Index
Trigger: Enrol on Day 0

Subject: [Company] — which of your roles is most at risk from AI?

"[Name], we built a free tool that takes any job description and returns
a scored breakdown of which tasks AI can handle today vs. which still
need a human. Takes 60 seconds. Thought it might be useful as you
think through [Company]'s workforce planning for 2026.

→ [Try it on any role: AI Automation Index]"

────────────────────────────────────────────────────────────────

TOUCH 2A — Day 3-5 — Tool ⑥: Succession Bench Analyser
Trigger: CHRO used Tool ①

"[Name], since you looked at automation risk for [role] — the related
question we hear from CHROs is: for the roles that still need a human,
how deep is your bench? Built a tool that gives you a Ready Now /
1-Year / 3-Year succession score for any critical role.

→ [Run a succession analysis: Succession Bench Analyser]"

TOUCH 2B — Day 10 — Tool ②: Role Redesign Planner
Trigger: CHRO did not engage with Touch 1

"[Name], as AI changes what roles do, most forward-looking HR leaders
we talk to are redesigning jobs — not replacing people. Built a tool
that shows exactly how any role should split between human work and AI
work, with a phased transition plan.

→ [Try it free: Role Redesign Planner]"

────────────────────────────────────────────────────────────────

TOUCH 3A — Day 7-10 after Touch 2A — Sales CTA
Trigger: Used 2 tools

"[Name], you've now seen the automation risk picture and the succession
bench for [company]. The next step most CHROs take is seeing how this
works across their full workforce — not just one role at a time.
Worth 20 minutes?

→ [Book a 20-minute conversation]"

TOUCH 3B — Day 20 — Tool ⑦: Workforce AI Readiness Score
Trigger: Engaged with one tool only, or cold after Touch 2B

"[Name], one more angle — we built an org-level AI readiness score.
Paste your top 5 roles and the tool returns an overall readiness
rating, the roles carrying the most risk, and the 3 highest-ROI
actions. Takes 3 minutes.

→ [Get your org's AI readiness score]"
```

---

### Persona 2 — L&D / Talent Development Head
*3 tools available: ④ → ⑤ → ⑦*
*Priority order: skill gaps first (most immediate pain), then career paths, then org readiness*

```
TOUCH 1 — Day 0 — Tool ④: Skills Gap Radar
Trigger: Enrol on Day 0

Subject: What skills will your team need in 2027 that they don't have today?

"[Name], we built a tool that maps the gap between a team's current
skills and what AI-augmented versions of their roles will require
within 2 years. Paste a role or team description — it returns a
prioritised gap analysis in under a minute.

→ [Run a skills gap analysis: Skills Gap Radar]"

────────────────────────────────────────────────────────────────

TOUCH 2A — Day 3-5 — Tool ⑤: Career Path Intelligence
Trigger: L&D Head used Tool ④

"[Name], once you know the gaps, the next question is: what's the
fastest path for your people to close them? Our Career Path tool
takes a current skill profile and returns the 3 most viable career
paths — with the specific learning milestones for each, ranked by
AI automation risk.

→ [Try Career Path Intelligence]"

TOUCH 2B — Day 10 — Tool ⑤: Career Path Intelligence
Trigger: Did not engage with Touch 1

"[Name], different angle — if you have an employee wondering where
their career goes as AI changes their role, this tool gives them a
concrete answer in 2 minutes. Paste their current skills and target
role. Returns 3 path options with skills roadmaps.

→ [Try Career Path Intelligence]"

────────────────────────────────────────────────────────────────

TOUCH 3A — Day 7-10 after Touch 2A — Sales CTA
Trigger: Used 2 tools

"[Name], you've seen both the gap picture and the career path options.
What iMocha does is run this logic across your entire workforce
automatically — every employee, every role, continuously updated.
Worth a 20-minute conversation?

→ [Book time]"

TOUCH 3B — Day 20 — Tool ⑦: Workforce AI Readiness Score
Trigger: One tool used or cold

"[Name], last one — we built an org-level AI readiness score that
surfaces your 5 highest-risk roles and recommends where L&D investment
has the highest return. 3 minutes, no login required.

→ [Get your organisation's AI readiness score]"
```

---

### Persona 3 — Talent Acquisition Leader
*2 tools available: ③ → ①*
*Priority order: JD quality first (immediate daily pain), then role-level automation picture*

```
TOUCH 1 — Day 0 — Tool ③: Hiring Brief Scorer
Trigger: Enrol on Day 0

Subject: Is [Company] hiring for skills that AI will replace?

"[Name], we built a tool that scores any job description for
future-proof vs. at-risk skills — so you know whether you're
building a durable team or hiring into automation risk.
Paste a JD. Takes 30 seconds.

→ [Score a job brief: Hiring Brief Scorer]"

────────────────────────────────────────────────────────────────

TOUCH 2A — Day 3-5 — Tool ①: AI Automation Index
Trigger: TA Leader used Tool ③

"[Name], beyond which skills to hire for — thought you'd want to
see the full automation breakdown for a role you're hiring into.
The AI Automation Index scores every task in a role, not just the
skills. Useful context before you finalise a JD or benchmark.

→ [Run the full role analysis: AI Automation Index]"

TOUCH 2B — Day 10 — Tool ①: AI Automation Index
Trigger: Did not engage

"[Name], different take — paste any job description and this tool
returns a task-by-task automation risk score in 60 seconds.
Useful when a hiring manager asks 'should we even be hiring for
this role, or will AI handle it?'

→ [AI Automation Index — try it free]"

────────────────────────────────────────────────────────────────

TOUCH 3 — Day 15 (engaged) or Day 20 (cold) — Sales CTA

"[Name], iMocha's platform does this automatically across every
open role in your ATS — scoring JDs before they go live and
flagging at-risk hires in real time. Worth 20 minutes to see it?

→ [Book a conversation]"
```

---

### Persona 4 — Workforce Planning / People Analytics
*3 tools available: ② → ① → ⑦*
*Priority order: role redesign first (strategic planning pain), then task-level detail, then org score*

```
TOUCH 1 — Day 0 — Tool ②: Role Redesign Planner
Trigger: Enrol on Day 0

Subject: Which roles at [Company] need to be redesigned for AI?

"[Name], as AI changes what roles do, the forward-looking workforce
planning question isn't 'which jobs disappear' — it's 'how should
this job be redesigned.' We built a tool that answers that for any
role: a human/AI task split with a phased transition plan.

→ [Try the Role Redesign Planner]"

────────────────────────────────────────────────────────────────

TOUCH 2A — Day 3-5 — Tool ①: AI Automation Index
Trigger: Used Tool ②

"[Name], for the role you redesigned — thought you'd want to see
the underlying task-level automation scores that power it. The
AI Automation Index gives you the full breakdown: every task
scored 0-100, with specific AI tools for each.

→ [Run the AI Automation Index]"

TOUCH 2B — Day 10 — Tool ①: AI Automation Index
Trigger: Did not engage

"[Name], simpler entry point — paste any job description and
get a scored breakdown of every task's automation potential
in 60 seconds. Useful input for your workforce planning models.

→ [AI Automation Index]"

────────────────────────────────────────────────────────────────

TOUCH 3 — Sales CTA or Tool ⑦
(Same logic as CHRO Persona — see above)
```

---

### Persona 5 — HR Tech Evaluators & Analysts
*All 7 tools available*
*Approach: different — lead with content, not a single tool. Goal is amplification, not direct pipeline.*

```
TOUCH 1 — Day 0 — Content + Tool ①
Trigger: Enrol on Day 0

"[Name], we've built a portfolio of free AI tools that each
demonstrate a specific layer of iMocha's skills intelligence
platform — automation risk scoring, succession bench analysis,
career path planning, and more. The first one is live now.

Thought it might be useful as reference material for your
coverage of AI's impact on HR tech.

→ [AI Automation Index — free, self-serve]"

────────────────────────────────────────────────────────────────

TOUCH 2 — Day 14 — New tool announcement
Trigger: Time-based (as new tools ship)

"[Name], we just shipped [Tool Name] — a free tool that [one-line
aha moment]. Adding it to the portfolio. Happy to walk through
the full set if useful for anything you're writing or evaluating.

→ [Try it]"

────────────────────────────────────────────────────────────────

GOAL: Analyst/evaluator shares tools with their audience or
includes iMocha in coverage → amplification beyond our 5,000.
```

---

## Sequence Trigger Rules (Automation Logic)

| Trigger | Action | Timing |
|---------|--------|--------|
| Persona completes a tool analysis | Enrich in Clay → log in HubSpot → start next touch timer | Immediate |
| Persona uses 1 tool | Queue Touch 2A (engaged path) | 3-5 days |
| Persona opens email but doesn't use tool | Queue Touch 2B (cold path) | 10 days |
| Persona uses 2 tools | Slack alert to AE with enriched profile | Immediate |
| Persona uses 2 tools + AE reaches out | Remove from outreach sequence | Immediate |
| 3 touches sent, zero tool usage | Mark low-intent · pause sequence | Day 20 |
| Low-intent persona | Re-enrol with new tool when next tool ships | Day 60+ |
| Persona shares tool with a colleague (referral URL tracking) | Enrol colleague in relevant sequence · Alert AE | Immediate |

---

## The AI-Native Operating Model

> **One PM + One Technical Intern + AI = Output of a 6-person team**

- **Tool Build:** Claude Code generates ~80% of the code. Intern implements, QA's, deploys to Vercel. New tool live in 10 days.
- **Outreach Copy:** Claude generates personalised 3-line messages per persona segment, referencing company + role. PM reviews in batches.
- **Sequence Automation:** Clay + HubSpot handle trigger logic. No manual step between tool usage and next message.
- **Lead Enrichment:** Clay auto-enriches every trial with company size, ATS in use, funding stage, headcount. Scored before passing to Sales.
- **Learning Loop:** Weekly review of open rates, tool completion rates, and touch-to-trial conversion → prompt tuning → sequence optimisation.

---

## Success Metrics

| Metric | 30-Day | 60-Day | 90-Day |
|--------|--------|--------|--------|
| Tools live | 1 | 5 | 7 |
| Persona outreach sent | 500 | 2,500 | 5,000 |
| Tool trials completed | 200 | 1,500 | 5,000 |
| Trial-to-touch-2 conversion | — | 25% | 30% |
| Qualified leads (2+ tools used) | 25 | 150 | 600 |
| Sales-accepted leads handed to AE | 10 | 80 | 250 |
| Pipeline influenced ($) | $100K | $800K | $2M |
| Cost per qualified lead | — | $12 | <$10 |

---

## What This Costs

| Resource | Detail | Cost |
|----------|--------|------|
| PM time | 50% of Growth PM's time | Internal |
| Technical intern | 1 FTE, 90 days | ~$6,000 |
| AI API costs | Claude + LangSmith per tool run | ~$800/mo |
| Outreach tools | Clay + Apollo licenses | ~$600/mo |
| Paid amplification | LinkedIn Sponsored + community sponsorships | ~$3,000 |
| **Total 90-day budget** | | **~$15,000** |

---

## The Ask

**Sign-off on three things:**

1. **Budget:** Approve $15,000 for the 90-day ARIA pilot
2. **Access:** Connect Growth PM to Sales and Marketing ops for HubSpot + Clay + Apollo access
3. **GTM Alignment:** 30-minute session with Sales leadership to agree lead handoff SLA — target: AE contacts a 2-tool user within 24 hours of the Slack alert

**If this pilot hits 250 sales-accepted leads in 90 days, ARIA becomes a permanent motion — a compounding AI-native pipeline engine that scales with every new tool we ship.**

---

*Project ARIA · iMocha CEO's Office · Prepared by Growth PM · March 2026*
*"We build the tools. The tools build the pipeline."*
