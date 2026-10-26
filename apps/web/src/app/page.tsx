"use client";

import React, { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { ReviewBar } from "@/components/medgemma/ReviewBar";
import { Sidebar } from "@/components/medgemma/Sidebar";
import { Topbar } from "@/components/medgemma/Topbar";
import { Footnote } from "@/components/medgemma/CommonUI";
import { ModalRoot } from "@/components/medgemma/ModalRoot";
import { Toast } from "@/components/medgemma/Toast";
import type { PageId } from "@/types/workspace";

// 15 Modular Screen Components
import { LandingScreen } from "@/components/medgemma/screens/LandingScreen";
import { SignInScreen } from "@/components/medgemma/screens/SignInScreen";
import { OverviewScreen } from "@/components/medgemma/screens/OverviewScreen";
import { CasesScreen } from "@/components/medgemma/screens/CasesScreen";
import { CaseDetailScreen } from "@/components/medgemma/screens/CaseDetailScreen";
import { ChatScreen } from "@/components/medgemma/screens/ChatScreen";
import { ImagingScreen } from "@/components/medgemma/screens/ImagingScreen";
import { CompareScreen } from "@/components/medgemma/screens/CompareScreen";
import { ReportScreen } from "@/components/medgemma/screens/ReportScreen";
import { ReasoningScreen } from "@/components/medgemma/screens/ReasoningScreen";
import { EhrScreen } from "@/components/medgemma/screens/EhrScreen";
import { ExtractionScreen } from "@/components/medgemma/screens/ExtractionScreen";
import { QaScreen } from "@/components/medgemma/screens/QaScreen";
import { LibraryScreen } from "@/components/medgemma/screens/LibraryScreen";
import { SettingsScreen } from "@/components/medgemma/screens/SettingsScreen";

export default function MedGemmaWorkspaceApp() {
  const { page, setPage, closeModal } = useWorkspaceStore();

  // Synchronize hash in URL for deep linking (#overview, #imaging, etc.)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1) as PageId;
      if (hash && hash !== page) {
        setPage(hash);
      }
    };

    window.addEventListener("hashchange", handleHash);
    if (window.location.hash) {
      handleHash();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [page, setPage, closeModal]);

  const renderScreen = () => {
    switch (page) {
      case "landing":
        return <LandingScreen />;
      case "signin":
        return <SignInScreen />;
      case "overview":
        return <OverviewScreen />;
      case "cases":
        return <CasesScreen />;
      case "case":
        return <CaseDetailScreen />;
      case "chat":
        return <ChatScreen />;
      case "imaging":
        return <ImagingScreen />;
      case "compare":
        return <CompareScreen />;
      case "report":
        return <ReportScreen />;
      case "reasoning":
        return <ReasoningScreen />;
      case "ehr":
        return <EhrScreen />;
      case "extraction":
        return <ExtractionScreen />;
      case "qa":
        return <QaScreen />;
      case "library":
        return <LibraryScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <OverviewScreen />;
    }
  };

  const isStandalone = ["landing", "signin"].includes(page);

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#18181b]">
      {/* Fixed Review Bar to preview/switch between all 15 screens */}
      <ReviewBar />

      {/* Render standalone pages or the unified clinical shell */}
      {isStandalone ? (
        renderScreen()
      ) : (
        <div className="app">
          <Sidebar />
          <main className="main">
            <Topbar />
            <div className="content">
              {renderScreen()}
              <Footnote />
            </div>
          </main>
        </div>
      )}

      {/* Global Interactive Modals & Toasts */}
      <ModalRoot />
      <Toast />
    </div>
  );
}
