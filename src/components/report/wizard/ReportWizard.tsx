"use client";

import { useState, useEffect, useRef } from "react";
import type { CompanyWizardData, WizardRole } from "@/lib/report/aggregate";
import { useIsMobile } from "@/hooks/useIsMobile";
import { track } from "@/lib/reportTrack";
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
  company:     string;
  companyId:   string;
  companySlug: string;
  wizardData:  CompanyWizardData;
  token:       string;
}

export default function ReportWizard({ company, companyId, companySlug, wizardData, token }: Props) {
  const [step,       setStep]       = useState(1);
  const [activeRole, setActiveRole] = useState<WizardRole | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [infoPage,   setInfoPage]   = useState<InfoPage | null>(null);
  const isMobile = useIsMobile();

  const ctx = { token, companySlug, reportType: "hub" as const };
  const modalSubmittedRef = useRef(false);

  // Fire wizard_step_viewed on every step change
  useEffect(() => {
    track("wizard_step_viewed", ctx, { step, company });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goTo = (n: number) => {
    if (n !== 4) setActiveRole(null);
    setStep(n);
  };

  const handleBack = () => {
    if (step === 4 && activeRole) { setActiveRole(null); return; }
    if (step > 1) goTo(step - 1);
  };

  const openModal = (source: "nav" | "bottom_bar" | "step4_role_card") => {
    modalSubmittedRef.current = false;
    track("wizard_cta_clicked", ctx, { source, step });
    setModalOpen(true);
  };

  const handleModalClose = () => {
    if (!modalSubmittedRef.current) {
      track("wizard_cta_dismissed", ctx, { step });
    }
    setModalOpen(false);
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) goTo(step + 1);
    else openModal("bottom_bar");
  };

  // Step-4 role card opened → which roles a prospect drills into
  const handleRoleSelect = (role: WizardRole | null) => {
    if (role) {
      track("wizard_role_viewed", ctx, { role: role.jobTitle, score: role.overallAutomationScore });
    }
    setActiveRole(role);
  };

  // Vision / How-it-works overlay opened → methodology interest
  const handleInfo = (page: InfoPage) => {
    track("wizard_info_viewed", ctx, { page });
    setInfoPage(page);
  };

  // Trackpad horizontal swipe → step navigation
  const swipeLocked = useRef(false);
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
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

  // Touch swipe → step navigation (mobile)
  const touchStartX = useRef(0);
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchEnd   = (e: TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) < 50) return;
      if (diff > 0) handleContinue();
      else handleBack();
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend",   onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeRole]);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0e0e10", color: "#fff", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', overflow: "hidden" }}>
        <WizardNav
          step={step}
          isMobile={isMobile}
          hasActiveRole={!!activeRole}
          onBack={handleBack}
          onGetAnalysis={() => openModal("nav")}
          onVision={() => handleInfo("vision")}
          onHowItWorks={() => handleInfo("how-it-works")}
        />

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          {/* Subtle background gradients */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 15% 60%, rgba(74,222,128,0.05) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 85% 30%, rgba(253,90,15,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

          {step !== 4 && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: isMobile ? "0 16px" : "0 40px", overflowY: isMobile ? "auto" : "hidden" }}>
              {step === 1 && <Step1Glance  company={company} data={wizardData} isMobile={isMobile} />}
              {step === 2 && <Step2Benefit company={company} data={wizardData} isMobile={isMobile} />}
              {step === 3 && <Step3Peers   company={company} data={wizardData} isMobile={isMobile} />}
            </div>
          )}

          {step === 4 && (
            <Step4Roles
              company={company}
              data={wizardData}
              activeRole={activeRole}
              isMobile={isMobile}
              onRoleSelect={handleRoleSelect}
              onRequestAnalysis={() => openModal("step4_role_card")}
            />
          )}
        </div>

        <WizardBottomBar
          step={step}
          totalSteps={TOTAL_STEPS}
          isMobile={isMobile}
          onBack={handleBack}
          onContinue={handleContinue}
        />
      </div>

      {infoPage && <InfoOverlay page={infoPage} onClose={() => setInfoPage(null)} />}

      {modalOpen && (
        <HubSpotModal
          onClose={handleModalClose}
          onSubmitted={(email) => {
            modalSubmittedRef.current = true;
            if (email) {
              track("wizard_cta_submitted", ctx, { step, email });
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
