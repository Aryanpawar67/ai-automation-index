"use client";

import { useState, useEffect, useRef } from "react";
import type { CompanyWizardData, WizardRole } from "@/lib/report/aggregate";
import WizardNav              from "./WizardNav";
import WizardBottomBar        from "./WizardBottomBar";
import Step1Glance            from "./Step1Glance";
import Step2Benefit           from "./Step2Benefit";
import Step3Peers             from "./Step3Peers";
import Step4Roles             from "./Step4Roles";
import HubSpotModal           from "@/components/report/HubSpotModal";
import InfoOverlay, { type InfoPage } from "./InfoOverlay";

const TOTAL_STEPS = 4;

interface Props {
  company:    string;
  companyId:  string;
  wizardData: CompanyWizardData;
  token:      string;
}

export default function ReportWizard({ company, companyId, wizardData, token }: Props) {
  const [step,       setStep]       = useState(1);
  const [activeRole, setActiveRole] = useState<WizardRole | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [infoPage,   setInfoPage]   = useState<InfoPage | null>(null);

  const goTo = (n: number) => {
    if (n !== 4) setActiveRole(null);
    setStep(n);
  };

  // Trackpad horizontal swipe → step navigation
  const swipeLocked = useRef(false);
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      // Only act on predominantly horizontal swipes; ignore vertical scroll (Step 4)
      if (absX < 40 || absY > absX) return;
      if (swipeLocked.current) return;
      swipeLocked.current = true;
      setTimeout(() => { swipeLocked.current = false; }, 600);
      if (e.deltaX > 0) handleContinue();
      else handleBack();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeRole]);

  const handleBack = () => {
    if (step === 4 && activeRole) { setActiveRole(null); return; }
    if (step > 1) goTo(step - 1);
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) goTo(step + 1);
    else setModalOpen(true);
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0e0e10", color: "#fff", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', overflow: "hidden" }}>
        <WizardNav
          step={step}
          hasActiveRole={!!activeRole}
          onBack={handleBack}
          onGetAnalysis={() => setModalOpen(true)}
          onVision={() => setInfoPage("vision")}
          onHowItWorks={() => setInfoPage("how-it-works")}
        />

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          {/* Subtle background gradients */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 15% 60%, rgba(74,222,128,0.05) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 85% 30%, rgba(253,90,15,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

          {step !== 4 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 40px" }}>
              {step === 1 && <Step1Glance  company={company} data={wizardData} />}
              {step === 2 && <Step2Benefit company={company} data={wizardData} />}
              {step === 3 && <Step3Peers   company={company} data={wizardData} />}
            </div>
          )}

          {step === 4 && (
            <Step4Roles
              company={company}
              data={wizardData}
              activeRole={activeRole}
              onRoleSelect={setActiveRole}
              onRequestAnalysis={() => setModalOpen(true)}
            />
          )}
        </div>

        <WizardBottomBar
          step={step}
          totalSteps={TOTAL_STEPS}
          onBack={handleBack}
          onContinue={handleContinue}
        />
      </div>

      {infoPage && <InfoOverlay page={infoPage} onClose={() => setInfoPage(null)} />}

      {modalOpen && (
        <HubSpotModal
          onClose={() => setModalOpen(false)}
          onSubmitted={(email) => {
            if (email) {
              fetch(
                `/api/report/${companyId}/interest?token=${encodeURIComponent(token)}`,
                {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body:    JSON.stringify({ email, source: "cta" }),
                }
              ).catch(() => {});
            }
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
