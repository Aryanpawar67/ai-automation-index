"use client";

interface WizardBottomBarProps {
  step:       number;
  totalSteps: number;
  isMobile?:  boolean;
  onBack:     () => void;
  onContinue: () => void;
}

export default function WizardBottomBar({ step, totalSteps, isMobile, onBack, onContinue }: WizardBottomBarProps) {
  const isLast = step === totalSteps;

  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      padding:        isMobile ? "0 16px" : "0 40px",
      height:         64,
      borderTop:      "1px solid rgba(255,255,255,0.1)",
      flexShrink:     0,
    }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          background:   "rgba(255,255,255,0.07)",
          border:       "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding:      isMobile ? "8px 14px" : "8px 20px",
          color:        "#fff",
          fontSize:     13,
          fontWeight:   500,
          cursor:       "pointer",
          transition:   "background .15s",
          opacity:      step === 1 ? 0 : 1,
          pointerEvents: step === 1 ? "none" : "auto",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
      >
        ← Back
      </button>

      {/* Dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <button
            key={i}
            onClick={() => {/* dots are visual only — navigation via buttons */}}
            style={{
              height:       8,
              width:        i + 1 === step ? 28 : 8,
              borderRadius: 4,
              background:   i + 1 === step ? "#fff" : "rgba(255,255,255,0.25)",
              border:       "none",
              cursor:       "default",
              padding:      0,
              transition:   "width .3s ease, background .3s ease",
            }}
          />
        ))}
      </div>

      {/* Continue / CTA */}
      <button
        onClick={onContinue}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          background:   isLast ? "#FD5A0F" : "#4ade80",
          border:       "none",
          borderRadius: 8,
          padding:      isMobile ? "9px 16px" : "9px 22px",
          color:        isLast ? "#fff" : "#0e0e10",
          fontSize:     13,
          fontWeight:   700,
          cursor:       "pointer",
          transition:   "background .15s, transform .1s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = isLast ? "#e84e0a" : "#22c55e";
          (e.currentTarget as HTMLButtonElement).style.transform  = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = isLast ? "#FD5A0F" : "#4ade80";
          (e.currentTarget as HTMLButtonElement).style.transform  = "translateY(0)";
        }}
      >
        {isLast ? "Get your full analysis →" : "Continue →"}
      </button>
    </div>
  );
}
