"use client";

import { create } from "zustand";
import {
  type PageId,
  type CaseItem,
  type ExtractedFieldItem,
  INITIAL_CASES,
  INITIAL_EXTRACTED_FIELDS,
} from "@/types/workspace";

interface WorkspaceState {
  page: PageId;
  activeCase: string;
  activeCaseId: string;
  activeSourceId: string | null;
  imagingMode: "analysis" | "volume" | "localization";
  sliceIndex: number;
  selectedSeries: string;
  caseFilter: string;
  caseSearch: string;
  cases: CaseItem[];
  ehrTab: "Overview" | "Timeline" | "Sources";
  libraryType: string;
  librarySearch: string;
  settingTab: string;
  extractionField: string;
  extractedFields: ExtractedFieldItem[];
  chatMessages: string[];
  qaAnswer: boolean;
  activeModal: { type: "newcase" | "upload" | "source"; payload?: unknown } | null;
  toastMessage: string | null;

  setPage: (p: PageId) => void;
  setActiveCase: (c: string, id?: string) => void;
  setActiveCaseId: (id: string) => void;
  setActiveSourceId: (id: string | null) => void;
  setCases: (cases: CaseItem[]) => void;
  setImagingMode: (m: "analysis" | "volume" | "localization") => void;
  setSliceIndex: (s: number) => void;
  setSelectedSeries: (s: string) => void;
  setCaseFilter: (f: string) => void;
  setCaseSearch: (q: string) => void;
  addCase: (caseData: { id?: string; name: string; meta?: string; status?: string }) => void;
  setEhrTab: (t: "Overview" | "Timeline" | "Sources") => void;
  setLibraryType: (t: string) => void;
  setLibrarySearch: (q: string) => void;
  setSettingTab: (t: string) => void;
  setExtractionField: (f: string) => void;
  updateExtractedField: (id: string, value: string) => void;
  addChatMessage: (msg: string) => void;
  clearChat: () => void;
  setQaAnswer: (val: boolean) => void;
  openModal: (type: "newcase" | "upload" | "source", payload?: unknown) => void;
  closeModal: () => void;
  showToast: (msg: string) => void;
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  page: "overview",
  activeCase: "Case 024 · Chest review",
  activeCaseId: "11111111-1111-1111-1111-111111111111",
  activeSourceId: null,
  imagingMode: "analysis",
  sliceIndex: 124,
  selectedSeries: "01",
  caseFilter: "All cases",
  caseSearch: "",
  cases: INITIAL_CASES,
  ehrTab: "Overview",
  libraryType: "All files",
  librarySearch: "",
  settingTab: "Profile",
  extractionField: "hemoglobin",
  extractedFields: INITIAL_EXTRACTED_FIELDS,
  chatMessages: [],
  qaAnswer: false,
  activeModal: null,
  toastMessage: null,

  setPage: (p) => {
    set({ page: p });
    if (typeof window !== "undefined") {
      if (window.location.hash !== `#${p}`) {
        window.history.pushState(null, "", `#${p}`);
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  },

  setActiveCase: (c, id) => {
    set((state) => ({
      activeCase: c,
      activeCaseId: id || state.activeCaseId,
    }));
  },
  setActiveCaseId: (id) => set({ activeCaseId: id }),
  setActiveSourceId: (id) => set({ activeSourceId: id }),
  setCases: (cases) => set({ cases }),
  setImagingMode: (m) => set({ imagingMode: m }),
  setSliceIndex: (s) => set({ sliceIndex: Math.max(1, Math.min(240, Math.round(Number(s) || 1))) }),
  setSelectedSeries: (s) => set({ selectedSeries: s }),
  setCaseFilter: (f) => set({ caseFilter: f }),
  setCaseSearch: (q) => set({ caseSearch: q }),

  addCase: ({ id, name, meta = "No sources yet", status = "In progress" }) => {
    set((state) => {
      let caseId = id;
      if (!caseId) {
        const numericIds = state.cases
          .map((item) => {
            const num = Number.parseInt(String(item.id).replace(/\D/g, ""), 10);
            return Number.isFinite(num) ? num : 0;
          })
          .filter((n) => !Number.isNaN(n));
        const maxId = numericIds.length > 0 ? Math.max(0, ...numericIds) : 0;
        caseId = String(maxId + 1).padStart(3, "0");
      }
      const newCase: CaseItem = {
        id: caseId,
        name,
        meta,
        status,
        date: "Just now",
      };
      return {
        cases: [newCase, ...state.cases],
        activeCase: `${name}`,
        activeCaseId: caseId.length === 36 ? caseId : state.activeCaseId,
        caseFilter: "All cases",
        caseSearch: "",
      };
    });
    get().setPage("cases");
  },

  setEhrTab: (t) => set({ ehrTab: t }),
  setLibraryType: (t) => set({ libraryType: t }),
  setLibrarySearch: (q) => set({ librarySearch: q }),
  setSettingTab: (t) => set({ settingTab: t }),
  setExtractionField: (f) => set({ extractionField: f }),

  updateExtractedField: (id, value) =>
    set((state) => ({
      extractedFields: state.extractedFields.map((f) =>
        f.id === id ? { ...f, value } : f
      ),
    })),

  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, msg],
    })),

  clearChat: () => set({ chatMessages: [] }),
  setQaAnswer: (val) => set({ qaAnswer: val }),

  openModal: (type, payload) => set({ activeModal: { type, payload } }),
  closeModal: () => set({ activeModal: null }),

  showToast: (msg) => {
    if (toastTimeout) clearTimeout(toastTimeout);
    set({ toastMessage: msg });
    toastTimeout = setTimeout(() => {
      set({ toastMessage: null });
    }, 4500);
  },
}));
