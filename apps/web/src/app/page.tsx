"use client";

import React, { type ComponentType } from "react";
import { useWorkspaceNavigation } from "@/hooks/useWorkspaceNavigation";
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

const SCREENS: Record<PageId, ComponentType> = {
  landing: LandingScreen,
  signin: SignInScreen,
  overview: OverviewScreen,
  cases: CasesScreen,
  case: CaseDetailScreen,
  chat: ChatScreen,
  imaging: ImagingScreen,
  compare: CompareScreen,
  report: ReportScreen,
  reasoning: ReasoningScreen,
  ehr: EhrScreen,
  extraction: ExtractionScreen,
  qa: QaScreen,
  library: LibraryScreen,
  settings: SettingsScreen,
};

export default function MedGemmaWorkspaceApp() {
  const page = useWorkspaceStore((state) => state.page);
  useWorkspaceNavigation();
  const Screen = SCREENS[page];

  const isStandalone = ["landing", "signin"].includes(page);

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#18181b]">
      {/* Fixed Review Bar to preview/switch between all 15 screens */}
      <ReviewBar />

      {/* Render standalone pages or the unified clinical shell */}
      {isStandalone ? (
        <Screen />
      ) : (
        <div className="app">
          <Sidebar />
          <main className="main">
            <Topbar />
            <div className="content">
              <Screen />
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
