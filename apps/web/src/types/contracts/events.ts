import type { RunId } from "../brands";

export type SSERunEvent =
  | {
      readonly event: "snapshot";
      readonly run_id: RunId | string;
      readonly status: string;
      readonly output_json?: Record<string, unknown> | null;
      readonly metrics_json?: Record<string, unknown>;
      readonly error_detail?: string | null;
    }
  | {
      readonly event: "status";
      readonly run_id: RunId | string;
      readonly status: string;
      readonly stage: string;
      readonly progress_pct?: number;
    }
  | {
      readonly event: "completed";
      readonly run_id: RunId | string;
      readonly status: "completed";
      readonly output_json: Record<string, unknown>;
      readonly metrics_json: Record<string, unknown>;
    }
  | {
      readonly event: "failed";
      readonly run_id: RunId | string;
      readonly status: "failed";
      readonly error_detail: string;
    }
  | {
      readonly event: "cancelled";
      readonly run_id: RunId | string;
      readonly status: "cancelled";
      readonly error_detail?: string;
    };

export type AsyncState<T, E = Error> =
  | { readonly status: "idle"; readonly data?: undefined; readonly error?: undefined }
  | { readonly status: "loading"; readonly data?: T; readonly error?: undefined }
  | { readonly status: "success"; readonly data: T; readonly error?: undefined }
  | { readonly status: "error"; readonly data?: T; readonly error: E };

export type RunExecutionState<TOutput> =
  | { readonly status: "idle" }
  | { readonly status: "queued"; readonly runId: RunId | string }
  | { readonly status: "running"; readonly runId: RunId | string; readonly stage: string }
  | {
      readonly status: "completed";
      readonly runId: RunId | string;
      readonly output: TOutput;
      readonly metrics: Record<string, unknown>;
    }
  | { readonly status: "failed"; readonly runId: RunId | string; readonly error: string }
  | { readonly status: "cancelled"; readonly runId: RunId | string };

