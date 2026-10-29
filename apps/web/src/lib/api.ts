/**
 * MedGemma Unified API Client
 * Connects Next.js Frontend to FastAPI Backend & GPU Service
 */

export interface SystemHealth {
  status: string;
  service: string;
  mode: string;
  checkpoint: string;
}

export interface SystemInfo {
  title: string;
  version: string;
  processor_version: string;
  gpu_service_url: string;
}

export interface ApiCase {
  id: string;
  workspace_id: string;
  patient_code: string;
  title: string;
  status: string;
  created_at: string;
  sources_count: number;
}

export interface ApiSourceFile {
  id: string;
  filename: string;
  file_kind: string;
  mime_type: string;
  byte_size: number;
  parse_status: string;
  created_at: string;
}

export interface ApiCaseDetail extends ApiCase {
  source_files: ApiSourceFile[];
}

export interface UploadGrant {
  source_file_id: string;
  storage_key: string;
  presigned_put_url: string;
  expires_in_seconds: number;
}

export interface UploadCompleteResult {
  source_file_id: string;
  parse_status: string;
  verified_byte_size: number;
  sha256_hash: string;
  outbox_job_id: string;
}

export interface RunSummary {
  run_id: string;
  status: string;
  task_type: string;
  output_json: Record<string, unknown> | null;
  metrics_json: Record<string, unknown>;
}

export interface CitationView {
  citation_id?: string;
  evidence_chunk_id: string;
  source_file_id: string;
  page_or_frame: number;
  bbox_norm?: { x0: number; y0: number; x1: number; y1: number } | null;
  verbatim_text: string;
}

export interface ReportVersion {
  id: string;
  case_id: string;
  version_number: number;
  review_status: "draft" | "reviewed" | "exported" | string;
  reviewed_by?: string | null;
  export_download_url?: string | null;
  tiptap_doc_json: Record<string, unknown>;
  citations_snapshot_json?: Array<Record<string, unknown>>;
  created_at: string;
}

export interface StudyAnnotation {
  id: string;
  source_file_id: string;
  frame_index: number;
  origin: "manual" | "model_medgemma";
  anatomical_label: string;
  finding_text?: string | null;
  bbox_norm: { x0: number; y0: number; x1: number; y1: number };
  review_state: "pending_review" | "accepted" | "rejected";
}

export interface ViewerManifest {
  source_file_id: string;
  study_title: string;
  study_date?: string | null;
  view_position?: string;
  image_url: string;
  is_dicom: boolean;
  image_width: number;
  image_height: number;
  annotations: StudyAnnotation[];
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class MedGemmaApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = this.getHeaders((options.headers as Record<string, string>) || {});
    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let detail = `Request failed: ${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson?.detail) {
          detail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // use fallback status text
      }
      throw new Error(detail);
    }

    if (res.status === 204) {
      return {} as T;
    }
    return (await res.json()) as T;
  }

  // --- Health & Info ---

  async getHealth(): Promise<SystemHealth> {
    return this.request<SystemHealth>("/health");
  }

  async getSystemInfo(): Promise<SystemInfo> {
    return this.request<SystemInfo>("/api/v1/info");
  }

  // --- Cases Management ---

  async listCases(): Promise<ApiCase[]> {
    return this.request<ApiCase[]>("/api/v1/cases");
  }

  async createCase(patientCode: string, title: string): Promise<ApiCase> {
    return this.request<ApiCase>("/api/v1/cases", {
      method: "POST",
      body: JSON.stringify({ patient_code: patientCode, title }),
    });
  }

  async getCaseDetail(caseId: string): Promise<ApiCaseDetail> {
    return this.request<ApiCaseDetail>(`/api/v1/cases/${caseId}`);
  }

  async listCaseSources(caseId: string): Promise<ApiSourceFile[]> {
    return this.request<ApiSourceFile[]>(`/api/v1/cases/${caseId}/sources`);
  }

  // --- File Upload & Verification ---

  async presignUpload(
    caseId: string,
    file: { filename: string; file_kind: string; mime_type: string; byte_size: number; sha256_hash: string }
  ): Promise<UploadGrant> {
    return this.request<UploadGrant>(`/api/v1/cases/${caseId}/uploads/presign`, {
      method: "POST",
      body: JSON.stringify(file),
    });
  }

  async uploadToS3(presignedPutUrl: string, fileBytes: Blob, mimeType: string): Promise<void> {
    const res = await fetch(presignedPutUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: fileBytes,
    });
    if (!res.ok) {
      throw new Error(`Direct S3 upload failed with status ${res.status}`);
    }
  }

  async completeUpload(caseId: string, sourceFileId: string): Promise<UploadCompleteResult> {
    return this.request<UploadCompleteResult>(`/api/v1/cases/${caseId}/uploads/${sourceFileId}/complete`, {
      method: "POST",
    });
  }

  // --- Medical Q&A & AI Runs ---

  async createQARun(
    caseId: string,
    question: string,
    selectedSourceIds: string[] = []
  ): Promise<RunSummary> {
    return this.request<RunSummary>(`/api/v1/cases/${caseId}/runs/qa`, {
      method: "POST",
      body: JSON.stringify({
        question,
        selected_source_ids: selectedSourceIds,
      }),
    });
  }

  subscribeRunEvents(
    caseId: string,
    runId: string,
    onEvent: (event: string, data: Record<string, unknown>) => void,
    onError?: (err: Event) => void
  ): EventSource {
    const url = `${API_BASE_URL}/api/v1/cases/${caseId}/runs/${runId}/events${this.token ? `?token=${this.token}` : ""}`;
    const es = new EventSource(url);

    es.addEventListener("snapshot", (e: MessageEvent) => {
      try {
        onEvent("snapshot", JSON.parse(e.data));
      } catch {
        onEvent("snapshot", { raw: e.data });
      }
    });

    es.addEventListener("token", (e: MessageEvent) => {
      try {
        onEvent("token", JSON.parse(e.data));
      } catch {
        onEvent("token", { raw: e.data });
      }
    });

    es.addEventListener("completed", (e: MessageEvent) => {
      try {
        onEvent("completed", JSON.parse(e.data));
      } catch {
        onEvent("completed", { raw: e.data });
      }
      es.close();
    });

    es.addEventListener("error", (e: Event) => {
      if (onError) onError(e);
      es.close();
    });

    return es;
  }

  async saveDraftFromRun(caseId: string, runId: string): Promise<ReportVersion> {
    return this.request<ReportVersion>(`/api/v1/cases/${caseId}/runs/${runId}/save-draft`, {
      method: "POST",
    });
  }

  async cancelActiveRun(caseId: string, runId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(`/api/v1/cases/${caseId}/runs/${runId}/cancel`, {
      method: "POST",
    });
  }

  // --- EHR Summarizer ---

  async triggerEhrSummary(caseId: string, selectedSourceIds: string[] = []): Promise<RunSummary> {
    return this.request<RunSummary>(`/api/v1/cases/${caseId}/runs/ehr-summary`, {
      method: "POST",
      body: JSON.stringify({ selected_source_ids: selectedSourceIds }),
    });
  }

  async getCitationView(caseId: string, evidenceChunkId: string): Promise<CitationView> {
    return this.request<CitationView>(`/api/v1/cases/${caseId}/evidence/${evidenceChunkId}/citation-view`);
  }

  // --- Clinical Reports Studio ---

  async listReportVersions(caseId: string): Promise<ReportVersion[]> {
    return this.request<ReportVersion[]>(`/api/v1/cases/${caseId}/reports/versions`);
  }

  async createReportVersion(
    caseId: string,
    tiptapDocJson: Record<string, unknown>,
    citationsSnapshot: Array<Record<string, unknown>> = []
  ): Promise<ReportVersion> {
    return this.request<ReportVersion>(`/api/v1/cases/${caseId}/reports/versions`, {
      method: "POST",
      body: JSON.stringify({
        tiptap_doc_json: tiptapDocJson,
        citations_snapshot: citationsSnapshot,
      }),
    });
  }

  async reviewReportVersion(caseId: string, versionNumber: number): Promise<ReportVersion> {
    return this.request<ReportVersion>(`/api/v1/cases/${caseId}/reports/versions/${versionNumber}/review`, {
      method: "POST",
    });
  }

  async exportReportPdf(caseId: string, versionNumber: number): Promise<{ outbox_job_id: string; status: string }> {
    return this.request<{ outbox_job_id: string; status: string }>(
      `/api/v1/cases/${caseId}/reports/versions/${versionNumber}/export-pdf`,
      { method: "POST" }
    );
  }

  // --- Medical Imaging & Annotations ---

  async getViewerManifest(caseId: string, sourceFileId: string): Promise<ViewerManifest> {
    return this.request<ViewerManifest>(`/api/v1/cases/${caseId}/imaging/studies/${sourceFileId}/viewer-manifest`);
  }

  async createAnnotation(
    caseId: string,
    payload: {
      source_file_id: string;
      anatomical_label: string;
      bbox_norm: { x0: number; y0: number; x1: number; y1: number };
      finding_text?: string;
      frame_index?: number;
    }
  ): Promise<StudyAnnotation> {
    return this.request<StudyAnnotation>(`/api/v1/cases/${caseId}/imaging/annotations`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateAnnotationReview(
    caseId: string,
    annotationId: string,
    reviewState: "accepted" | "rejected",
    findingText?: string
  ): Promise<StudyAnnotation> {
    return this.request<StudyAnnotation>(`/api/v1/cases/${caseId}/imaging/annotations/${annotationId}`, {
      method: "PATCH",
      body: JSON.stringify({ review_state: reviewState, finding_text: findingText }),
    });
  }

  async triggerSingleXrayAnalysis(caseId: string, sourceFileId: string): Promise<RunSummary> {
    return this.request<RunSummary>(`/api/v1/cases/${caseId}/imaging/runs/analyze-single`, {
      method: "POST",
      body: JSON.stringify({ source_file_id: sourceFileId }),
    });
  }

  async triggerLongitudinalCompare(
    caseId: string,
    currentSourceId: string,
    priorSourceId: string
  ): Promise<RunSummary> {
    return this.request<RunSummary>(`/api/v1/cases/${caseId}/imaging/runs/compare-longitudinal`, {
      method: "POST",
      body: JSON.stringify({
        current_source_file_id: currentSourceId,
        prior_source_file_id: priorSourceId,
      }),
    });
  }
}

export const api = new MedGemmaApiClient();
