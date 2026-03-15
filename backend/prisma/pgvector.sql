-- MEOS:HELDEN — pgvector Setup
-- Run AFTER prisma migrate dev

CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding column on knowledge_chunks
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for fast cosine search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Weighted search function (Board R1: mandatory categories per page type)
CREATE OR REPLACE FUNCTION search_weighted(
  query_embedding vector(1536),
  page_type TEXT DEFAULT 'ORTS_LP',
  target_city TEXT DEFAULT NULL,
  max_results INT DEFAULT 12
)
RETURNS TABLE (
  id TEXT, category TEXT, subcategory TEXT,
  title TEXT, content TEXT, metadata JSONB,
  similarity FLOAT, reason TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY

  -- Mandatory: PAGE_TEMPLATE
  (SELECT kc.id, kc.category::TEXT, kc.subcategory, kc.title, kc.content,
          kc.metadata, 1.0::FLOAT, 'mandatory_template'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'PAGE_TEMPLATE' AND kc."isActive" = true
     AND kc.subcategory = LOWER(REPLACE(page_type, '_', ''))
   LIMIT 1)
  UNION ALL
  -- Mandatory: BRAND_SETTINGS
  (SELECT kc.id, kc.category::TEXT, kc.subcategory, kc.title, kc.content,
          kc.metadata, 0.98::FLOAT, 'mandatory_brand'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'BRAND_SETTINGS' AND kc."isActive" = true
     AND kc.subcategory = 'schreinerhelden'
   LIMIT 1)
  UNION ALL
  -- Mandatory for Orts-LP: LOKALKOLORIT
  (SELECT kc.id, kc.category::TEXT, kc.subcategory, kc.title, kc.content,
          kc.metadata, 0.97::FLOAT, 'mandatory_lokal'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'LOKALKOLORIT' AND kc."isActive" = true
     AND target_city IS NOT NULL AND kc.subcategory = LOWER(target_city)
   LIMIT 1)
  UNION ALL
  -- Mandatory: 2 EXPERT_PRINCIPLES (most relevant)
  (SELECT kc.id, kc.category::TEXT, kc.subcategory, kc.title, kc.content,
          kc.metadata, (1 - (kc.embedding <=> query_embedding))::FLOAT, 'mandatory_expert'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'EXPERT_PRINCIPLE' AND kc."isActive" = true
   ORDER BY kc.embedding <=> query_embedding LIMIT 2)
  UNION ALL
  -- Mandatory: SCHEMA_TEMPLATE
  (SELECT kc.id, kc.category::TEXT, kc.subcategory, kc.title, kc.content,
          kc.metadata, 0.95::FLOAT, 'mandatory_schema'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'SCHEMA_TEMPLATE' AND kc."isActive" = true
   ORDER BY kc.embedding <=> query_embedding LIMIT 1)
  UNION ALL
  -- Fill: top similar from any category
  (SELECT kc.id, kc.category::TEXT, kc.subcategory, kc.title, kc.content,
          kc.metadata, (1 - (kc.embedding <=> query_embedding))::FLOAT, 'similarity'::TEXT
   FROM knowledge_chunks kc
   WHERE kc."isActive" = true AND (1 - (kc.embedding <=> query_embedding)) > 0.25
   ORDER BY kc.embedding <=> query_embedding
   LIMIT max_results)

  LIMIT max_results;
END; $$;
