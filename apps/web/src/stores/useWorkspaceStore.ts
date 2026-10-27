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
  setActiveCase: (c: string) => void;
  setImagingMode: (m: "analysis" | "volume" | "localization") => void;
  setSliceIndex: (s: number) => void;
  setSelectedSeries: (s: string) => void;
  setCaseFilter: (f: string) => void;
  setCaseSearch: (q: string) => void;
  addCase: (caseData: { name: string; meta?: string; status?: string }) => void;
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

  setActiveCase: (c) => set({ activeCase: c }),
  setImagingMode: (m) => set({ imagingMode: m }),
  setSliceIndex: (s) => set({ sliceIndex: Math.max(1, Math.min(240, Math.round(Number(s) || 1))) }),
  setSelectedSeries: (s) => set({ selectedSeries: s }),
  setCaseFilter: (f) => set({ caseFilter: f }),
  setCaseSearch: (q) => set({ caseSearch: q }),

  addCase: ({ name, meta = "No sources yet", status = "In progress" }) => {
    set((state) => {
      const numericIds = state.cases
        .map((item) => {
          const num = Number.parseInt(String(item.id).replace(/\D/g, ""), 10);
          return Number.isFinite(num) ? num : 0;
        })
        .filter((n) => !Number.isNaN(n));
      const maxId = numericIds.length > 0 ? Math.max(0, ...numericIds) : 0;
      const nextId = String(maxId + 1).padStart(3, "0");
      const newCase: CaseItem = {
        id: nextId,
        name,
        meta,
        status,
        date: "Just now",
      };
      return {
        cases: [newCase, ...state.cases],
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
