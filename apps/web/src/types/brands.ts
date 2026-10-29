/**
 * Nominal Brand Type Utility
 * Prevents accidental argument transpositions between UUID strings.
 */
declare const __brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type CaseId = Brand<string, "CaseId">;
export type SourceFileId = Brand<string, "SourceFileId">;
export type RunId = Brand<string, "RunId">;
export type EvidenceChunkId = Brand<string, "EvidenceChunkId">;
export type AnnotationId = Brand<string, "AnnotationId">;
export type ReportVersionId = Brand<string, "ReportVersionId">;
export type WorkspaceId = Brand<string, "WorkspaceId">;
export type UserId = Brand<string, "UserId">;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(val: string): boolean {
  return UUID_REGEX.test(val);
}

export function toCaseId(val: string): CaseId {
  return val as CaseId;
}

export function toSourceFileId(val: string): SourceFileId {
  return val as SourceFileId;
}

export function toRunId(val: string): RunId {
  return val as RunId;
}

export function toEvidenceChunkId(val: string): EvidenceChunkId {
  return val as EvidenceChunkId;
}

export function toAnnotationId(val: string): AnnotationId {
  return val as AnnotationId;
}

