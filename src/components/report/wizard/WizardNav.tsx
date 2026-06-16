"use client";

interface WizardNavProps {
  step:            number;
  hasActiveRole:   boolean;
  isMobile?:       boolean;
  onBack:          () => void;
  onGetAnalysis:   () => void;
  onVision:        () => void;
  onHowItWorks:    () => void;
}

export default function WizardNav({ step, hasActiveRole, isMobile, onBack, onGetAnalysis, onVision, onHowItWorks }: WizardNavProps) {
  const backHidden = step === 1 && !hasActiveRole;

  return (
    <nav style={{
      display:         "flex",
      alignItems:      "center",
      justifyContent:  "space-between",
      padding:         isMobile ? "0 16px" : "0 40px",
      height:          60,
      borderBottom:    "1px solid rgba(255,255,255,0.1)",
      flexShrink:      0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onBack}
          style={{
            background:    "none",
            border:        "none",
            color:         "rgba(255,255,255,0.5)",
            fontSize:      20,
            cursor:        "pointer",
            padding:       "4px 8px",
            borderRadius:  6,
            lineHeight:    1,
            transition:    "color .15s, background .15s",
            opacity:       backHidden ? 0 : 1,
            pointerEvents: backHidden ? "none" : "auto",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
            (e.currentTarget as HTMLButtonElement).style.background = "none";
          }}
          aria-hidden={backHidden}
        >
          ←
        </button>
        <img
          src="/imocha-logo.png"
          alt="iMocha"
          style={{ height: 24, width: "auto", filter: "brightness(0) invert(1)", display: "block" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 28 }}>
        {!isMobile && (
          <>
            <button onClick={onVision} style={{ background: "none", border: "none", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
              Vision
            </button>
            <button onClick={onHowItWorks} style={{ background: "none", border: "none", fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
              How it works
            </button>
          </>
        )}
        <button
          onClick={onGetAnalysis}
          style={{
            background:   "#FD5A0F",
            color:        "#fff",
            border:       "none",
            borderRadius: 8,
            padding:      isMobile ? "8px 14px" : "9px 20px",
            fontSize:     isMobile ? 12 : 13,
            fontWeight:   700,
            cursor:       "pointer",
            transition:   "background .15s, transform .1s",
            whiteSpace:   "nowrap",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#e84e0a";
            (e.currentTarget as HTMLButtonElement).style.transform  = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#FD5A0F";
            (e.currentTarget as HTMLButtonElement).style.transform  = "translateY(0)";
          }}
        >
          {isMobile ? "Get analysis" : "Get your custom analysis"}
        </button>
      </div>
    </nav>
  );
}
