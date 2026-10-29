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
  filename?: string;
  encounter_date?: string | null;
  page_or_frame: number;
  bbox_norm?: { x0: number; y0: number; x1: number; y1: number } | null;
  section_type?: string;
  verbatim_text: string;
  page_preview_url?: string | null;
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
  filename?: string;
  file_kind?: string;
  raw_dicom_or_image_url?: string;
  normalized_display_png_url?: string;
  metadata?: Record<string, unknown>;
  study_title: string;
  study_date?: string | null;
  view_position?: string;
  image_url: string;
  is_dicom: boolean;
  image_width: number;
  image_height: number;
  annotations: StudyAnnotation[];
}

export interface ExtractionFieldItem {
  id: string;
  label: string;
  value: string;
  unit?: string;
  reference_range?: string;
  confidence?: number;
  page?: number;
  bbox_norm?: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface ExtractionResult {
  run_id: string;
  case_id: string;
  source_file_id?: string | null;
  review_status: string;
  fields: ExtractionFieldItem[];
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

    const dispatchNormalized = (eventName: string, rawData: string) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawData);
      } catch {
        data = { raw: rawData };
      }
      if (data.output_json && !data.output) {
        data.output = data.output_json;
      }
      if (data.metrics_json && !data.metrics) {
        data.metrics = data.metrics_json;
      }
      if (typeof data.output === "object" && data.output !== null) {
        const out = data.output as Record<string, unknown>;
        if (out.comparison_summary_markdown && !out.comparison_findings) {
          out.comparison_findings = out.comparison_summary_markdown;
        }
      }
      onEvent(eventName, data);
    };

    es.addEventListener("snapshot", (e: MessageEvent) => {
      dispatchNormalized("snapshot", e.data);
    });

    es.addEventListener("status", (e: MessageEvent) => {
      dispatchNormalized("status", e.data);
    });

    es.addEventListener("token", (e: MessageEvent) => {
      dispatchNormalized("token", e.data);
    });

    es.addEventListener("completed", (e: MessageEvent) => {
      dispatchNormalized("completed", e.data);
      es.close();
    });

    es.addEventListener("failed", (e: MessageEvent) => {
      dispatchNormalized("failed", e.data);
      es.close();
    });

    es.addEventListener("cancelled", (e: MessageEvent) => {
      dispatchNormalized("cancelled", e.data);
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
    const raw = await this.request<any>(`/api/v1/cases/${caseId}/imaging/studies/${sourceFileId}/viewer-manifest`);
    return {
      source_file_id: raw.source_file_id,
      filename: raw.filename,
      file_kind: raw.file_kind,
      raw_dicom_or_image_url: raw.raw_dicom_or_image_url,
      normalized_display_png_url: raw.normalized_display_png_url,
      metadata: raw.metadata || {},
      study_title: raw.filename || "Chest Study",
      study_date: raw.metadata?.study_date || null,
      view_position: raw.metadata?.view_position || "PA",
      image_url: raw.normalized_display_png_url || raw.raw_dicom_or_image_url,
      is_dicom: raw.file_kind === "dicom",
      image_width: raw.metadata?.columns || 2048,
      image_height: raw.metadata?.rows || 2048,
      annotations: (raw.annotations || []).map((a: any) => ({
        id: a.id,
        source_file_id: raw.source_file_id,
        frame_index: a.frame_index ?? 0,
        origin: a.origin ?? "manual",
        anatomical_label: a.anatomical_label,
        finding_text: a.finding_text ?? null,
        bbox_norm: a.bbox_norm,
        review_state: a.review_state ?? "accepted",
      })),
    };
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

  // --- Document Extraction ---

  async triggerDocumentExtraction(
    caseId: string,
    sourceFileId?: string,
    targetFields: string[] = ["date", "specimen", "hemoglobin", "wbc", "platelets"]
  ): Promise<ExtractionResult> {
    return this.request<ExtractionResult>(`/api/v1/cases/${caseId}/runs/extract-fields`, {
      method: "POST",
      body: JSON.stringify({
        source_file_id: sourceFileId || null,
        target_fields: targetFields,
      }),
    });
  }

  async saveFieldCorrections(
    caseId: string,
    runId: string,
    corrections: Record<string, string>,
    reviewStatus: string = "reviewed"
  ): Promise<ExtractionResult> {
    return this.request<ExtractionResult>(`/api/v1/cases/${caseId}/runs/${runId}/corrections`, {
      method: "POST",
      body: JSON.stringify({
        review_status: reviewStatus,
        corrections,
      }),
    });
  }
}

export const api = new MedGemmaApiClient();
