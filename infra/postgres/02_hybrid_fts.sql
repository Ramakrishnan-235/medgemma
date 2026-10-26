-- Add a generated tsvector column using the 'simple' + 'english' configuration
-- so both exact clinical abbreviations and stemmed medical terms are indexed.
ALTER TABLE evidence_chunks
ADD COLUMN IF NOT EXISTS content_tsv tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(section_type, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content_text, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS idx_evidence_chunks_tsv_gin
ON evidence_chunks USING GIN (content_tsv);
