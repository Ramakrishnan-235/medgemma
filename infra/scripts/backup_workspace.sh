#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_ROOT="${BACKUP_ROOT:-./backups/${STAMP}}"
mkdir -p "${BACKUP_ROOT}"

echo "[1/2] Dumping authoritative PostgreSQL + pgvector database..."
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-medgemma}" \
  -d "${POSTGRES_DB:-medgemma_workspace}" \
  -Fc > "${BACKUP_ROOT}/medgemma_pg.dump"

echo "[2/2] Archiving private MinIO/S3 clinical-cases bucket..."
docker compose exec -T minio tar -czf - /data/clinical-cases > "${BACKUP_ROOT}/clinical_cases_storage.tar.gz"

sha256sum "${BACKUP_ROOT}/medgemma_pg.dump" "${BACKUP_ROOT}/clinical_cases_storage.tar.gz" > "${BACKUP_ROOT}/SHA256SUMS"
echo "Backup complete: ${BACKUP_ROOT}"
