-- ============================================
-- MEOS:HELDEN — Database Init Script
-- Run this against Supabase to ensure correct structure
-- Safe to run multiple times (IF NOT EXISTS everywhere)
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── USERS ──
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'team',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ── KNOWLEDGE CHUNKS ──
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  "isActive" BOOLEAN DEFAULT true,
  embedding vector(1536),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure embedding column exists (if table was created without it)
DO $$ BEGIN
  ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_kc_category ON knowledge_chunks (category);
CREATE INDEX IF NOT EXISTS idx_kc_category_sub ON knowledge_chunks (category, subcategory);

-- HNSW index for vector search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ── CITY PROFILES ──
CREATE TABLE IF NOT EXISTS city_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier INT NOT NULL,
  einwohner INT,
  "kaufkraftIndex" FLOAT,
  "entfernungKm" INT,
  "fahrtzeitMin" INT,
  "priorityScore" FLOAT,
  "geoCode" TEXT,
  "wikidataId" TEXT,
  stadtteile TEXT[] DEFAULT '{}',
  wohntypen TEXT[] DEFAULT '{}',
  "painPoints" TEXT[] DEFAULT '{}',
  lokalkolorit TEXT,
  "uniqueValueAdd" TEXT,
  "localBacklinks" TEXT[] DEFAULT '{}',
  "hasGbpStrategy" BOOLEAN DEFAULT false,
  "indexStatus" TEXT DEFAULT 'noindex',
  "firstExternalLink" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ── GENERATIONS ──
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "pageType" TEXT NOT NULL,
  status TEXT DEFAULT 'INTELLIGENCE',
  "layoutVariant" TEXT,
  "primaryKeyword" TEXT NOT NULL,
  "secondaryKeywords" TEXT[] DEFAULT '{}',
  "targetCity" TEXT,
  "targetProduct" TEXT,
  "serpData" JSONB,
  "keywordCluster" JSONB,
  "competitorData" JSONB,
  "gscData" JSONB,
  "searchIntent" TEXT,
  "topThreeAvgWords" INT,
  "strategyBrief" JSONB,
  "targetWordCount" INT,
  "clusterMapping" JSONB,
  "internalLinks" JSONB,
  "uniqueBlocks" TEXT[] DEFAULT '{}',
  "outputContent" TEXT,
  "outputSchema" JSONB,
  "outputMeta" JSONB,
  "ctaText" TEXT,
  "priceRange" TEXT,
  "boardScores" JSONB,
  "boardPass" BOOLEAN,
  "boardRound" INT DEFAULT 1,
  "exportHtml" TEXT,
  "exportFormat" TEXT DEFAULT 'generateblocks',
  "wpPostId" INT,
  "wpUrl" TEXT,
  "tokensUsed" INT,
  "costUsd" FLOAT,
  "durationMs" INT,
  model TEXT DEFAULT 'gpt-4o',
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gen_status ON generations (status);
CREATE INDEX IF NOT EXISTS idx_gen_pagetype ON generations ("pageType");
CREATE INDEX IF NOT EXISTS idx_gen_city ON generations ("targetCity");
CREATE INDEX IF NOT EXISTS idx_gen_created ON generations ("createdAt");

-- ── CHUNK USAGE ──
CREATE TABLE IF NOT EXISTS chunk_usage (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "generationId" TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  "chunkId" TEXT NOT NULL,
  "relevanceScore" FLOAT,
  "selectionReason" TEXT
);

CREATE INDEX IF NOT EXISTS idx_cu_gen ON chunk_usage ("generationId");

-- ── CLUSTER MAP ──
CREATE TABLE IF NOT EXISTS cluster_map (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "pillarSlug" TEXT UNIQUE NOT NULL,
  "pillarTitle" TEXT NOT NULL,
  "clusterSlugs" TEXT[] DEFAULT '{}',
  "healthScore" INT DEFAULT 0,
  "lastChecked" TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ── PUBLICATION CHECKS ──
CREATE TABLE IF NOT EXISTS publication_checks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "generationId" TEXT NOT NULL,
  "pageUrl" TEXT NOT NULL,
  "checkType" TEXT NOT NULL,
  result JSONB,
  "isHealthy" BOOLEAN DEFAULT true,
  "checkedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_gen ON publication_checks ("generationId");
CREATE INDEX IF NOT EXISTS idx_pc_type ON publication_checks ("checkType");

-- ── SOCIAL CONTENT ──
CREATE TABLE IF NOT EXISTS social_content (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "generationId" TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  content TEXT,
  "parsedData" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("generationId", channel)
);

CREATE INDEX IF NOT EXISTS idx_social_gen ON social_content ("generationId");

-- ── WEIGHTED SEARCH FUNCTION (RAG) ──
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
  (SELECT kc.id, kc.category, kc.subcategory, kc.title, kc.content,
          kc.metadata, 1.0::FLOAT, 'mandatory_template'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'PAGE_TEMPLATE' AND kc."isActive" = true
     AND kc.subcategory = LOWER(REPLACE(page_type, '_', ''))
   LIMIT 1)
  UNION ALL
  -- Mandatory: BRAND_SETTINGS
  (SELECT kc.id, kc.category, kc.subcategory, kc.title, kc.content,
          kc.metadata, 0.98::FLOAT, 'mandatory_brand'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'BRAND_SETTINGS' AND kc."isActive" = true
     AND kc.subcategory = 'schreinerhelden'
   LIMIT 1)
  UNION ALL
  -- Mandatory for Orts-LP: LOKALKOLORIT
  (SELECT kc.id, kc.category, kc.subcategory, kc.title, kc.content,
          kc.metadata, 0.97::FLOAT, 'mandatory_lokal'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'LOKALKOLORIT' AND kc."isActive" = true
     AND target_city IS NOT NULL AND kc.subcategory = LOWER(target_city)
   LIMIT 1)
  UNION ALL
  -- Mandatory: 2 EXPERT_PRINCIPLES (most relevant)
  (SELECT kc.id, kc.category, kc.subcategory, kc.title, kc.content,
          kc.metadata, (1 - (kc.embedding <=> query_embedding))::FLOAT, 'mandatory_expert'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'EXPERT_PRINCIPLE' AND kc."isActive" = true
     AND kc.embedding IS NOT NULL
   ORDER BY kc.embedding <=> query_embedding LIMIT 2)
  UNION ALL
  -- Mandatory: SCHEMA_TEMPLATE
  (SELECT kc.id, kc.category, kc.subcategory, kc.title, kc.content,
          kc.metadata, 0.95::FLOAT, 'mandatory_schema'::TEXT
   FROM knowledge_chunks kc
   WHERE kc.category = 'SCHEMA_TEMPLATE' AND kc."isActive" = true
     AND kc.embedding IS NOT NULL
   ORDER BY kc.embedding <=> query_embedding LIMIT 1)
  UNION ALL
  -- Fill: top similar from any category
  (SELECT kc.id, kc.category, kc.subcategory, kc.title, kc.content,
          kc.metadata, (1 - (kc.embedding <=> query_embedding))::FLOAT, 'similarity'::TEXT
   FROM knowledge_chunks kc
   WHERE kc."isActive" = true AND kc.embedding IS NOT NULL
     AND (1 - (kc.embedding <=> query_embedding)) > 0.25
   ORDER BY kc.embedding <=> query_embedding
   LIMIT max_results)

  LIMIT max_results;
END; $$;
