// ============================================
// MEOS:HELDEN — 6-Stage Pipeline Service (Raw SQL)
// Intelligence → Strategy → RAG → Generation → Board → Export
// All 34 Board improvements integrated
// ============================================

const OpenAI = require('openai');
const { query, queryOne, queryAll } = require('../db');

// Lazy init — only crashes when actually used, not on require
let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });
  }
  return openai;
}

const PROMPTS = require('../prompts/heldenformel');
const { fetchSERP, fetchKeywordVolumes, fetchOnPage } = require('./dataforseo');
const { fetchGSCData } = require('./gsc');

// ══════════════════════════════════════════
// STUFE 1: INTELLIGENCE
// ══════════════════════════════════════════

async function runIntelligence(generationId) {
  const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);
  const city = gen.targetCity
    ? await queryOne('SELECT * FROM city_profiles WHERE slug = $1', [gen.targetCity])
    : null;

  const serpQuery = [gen.primaryKeyword, city?.name].filter(Boolean).join(' ');
  const geoCode = city?.geoCode || '1003854';

  let serpData = null;
  try { serpData = await fetchSERP(serpQuery, geoCode); } catch (e) { console.error('SERP fetch failed:', e.message); }

  const keywordVariants = buildKeywordVariants(gen.primaryKeyword, city?.name);
  let keywordCluster = null;
  try { keywordCluster = await fetchKeywordVolumes(keywordVariants, geoCode); } catch (e) { console.error('Keyword volume fetch failed:', e.message); }

  let competitorData = null;
  if (serpData?.items?.length > 0) {
    const top3Urls = serpData.items.slice(0, 3).map(i => i.url).filter(Boolean);
    try { competitorData = await Promise.all(top3Urls.map(url => fetchOnPage(url))); } catch (e) { console.error('Competitor scan failed:', e.message); }
  }

  let gscData = null;
  try { gscData = await fetchGSCData(gen.primaryKeyword, city?.name); } catch (e) { console.error('GSC fetch failed:', e.message); }

  const searchIntent = classifyIntent(serpData, gen.primaryKeyword, city?.name);
  const topThreeAvgWords = competitorData
    ? Math.round(competitorData.reduce((sum, c) => sum + (c?.wordCount || 0), 0) / competitorData.length)
    : 1500;

  const secondaryKeywords = keywordCluster
    ? keywordCluster.filter(k => k.volume > 20).slice(0, 8).map(k => k.keyword)
    : [];

  await query(
    `UPDATE generations SET
      status='STRATEGY', "serpData"=$1, "keywordCluster"=$2, "competitorData"=$3,
      "gscData"=$4, "searchIntent"=$5, "topThreeAvgWords"=$6, "secondaryKeywords"=$7, "updatedAt"=NOW()
     WHERE id=$8`,
    [JSON.stringify(serpData), JSON.stringify(keywordCluster), JSON.stringify(competitorData),
     JSON.stringify(gscData), searchIntent, topThreeAvgWords, secondaryKeywords, generationId]
  );

  return { serpData, keywordCluster, competitorData, gscData, searchIntent, topThreeAvgWords };
}

function buildKeywordVariants(keyword, cityName) {
  const base = [keyword];
  if (cityName) {
    base.push(
      `${keyword} ${cityName}`, `${keyword} ${cityName} kosten`, `${keyword} ${cityName} erfahrung`,
      `schreiner ${cityName} ${keyword}`, `${keyword} nach maß ${cityName}`,
      `${keyword} ${cityName} preis`, `bester schreiner ${cityName}`,
      `schreinerei ${cityName}`, `einbauschrank ${cityName}`,
      `möbel nach maß ${cityName}`, `schrank nach maß ${cityName}`,
    );
  }
  base.push(`${keyword} kosten`, `${keyword} erfahrung`, `${keyword} selber planen`,
    `${keyword} vom schreiner`, `${keyword} vs konfigurator`);
  return [...new Set(base)].slice(0, 20);
}

function classifyIntent(serpData, keyword, cityName) {
  if (cityName && serpData?.items?.some(i => i.type === 'local_pack')) return 'local';
  if (cityName) return 'local';
  if (keyword.includes('kosten') || keyword.includes('preis') || keyword.includes('erfahrung')) return 'informational';
  if (keyword.includes('kaufen') || keyword.includes('bestellen') || keyword.includes('termin')) return 'transactional';
  return 'informational';
}

// ══════════════════════════════════════════
// STUFE 2: STRATEGY
// ══════════════════════════════════════════

async function runStrategy(generationId) {
  const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);
  const city = gen.targetCity
    ? await queryOne('SELECT * FROM city_profiles WHERE slug = $1', [gen.targetCity])
    : null;

  if (gen.pageType === 'ORTS_LP' && gen.searchIntent === 'national') {
    await query(
      `UPDATE generations SET status='REJECTED', "boardScores"=$1, "updatedAt"=NOW() WHERE id=$2`,
      [JSON.stringify({ warning: 'Intent ist national, nicht lokal.' }), generationId]
    );
    return { rejected: true, reason: 'National intent' };
  }

  const targetWordCount = Math.max(
    gen.pageType === 'PILLAR' ? 2500 : gen.pageType === 'BLOG' ? 1200 : 1500,
    Math.round((gen.topThreeAvgWords || 1500) * 1.15)
  );

  const layoutVariant = ['LAYOUT_A', 'LAYOUT_B', 'LAYOUT_C'][Math.floor(Math.random() * 3)];
  const clusterMapping = await determineCluster(gen.pageType, gen.targetCity);
  const uniqueBlocks = determineUniqueBlocks(gen.pageType, city);
  const ctaText = buildContextualCTA(gen.pageType, city?.name, gen.targetProduct);
  const priceRange = buildPriceRange(gen.targetProduct);

  const paaQuestions = gen.serpData?.items
    ?.filter(i => i.type === 'people_also_ask')?.map(i => i.title) || [];

  const strategyBrief = {
    pageType: gen.pageType, layoutVariant, targetWordCount,
    primaryKeyword: gen.primaryKeyword, secondaryKeywords: gen.secondaryKeywords,
    city: city?.name, clusterMapping, uniqueBlocks, ctaText, priceRange, paaQuestions,
    competitorGaps: analyzeCompetitorGaps(gen.competitorData),
    internalLinks: await suggestInternalLinks(gen.pageType, gen.targetCity, gen.targetProduct),
  };

  await query(
    `UPDATE generations SET
      status='RETRIEVAL', "strategyBrief"=$1, "targetWordCount"=$2, "layoutVariant"=$3,
      "clusterMapping"=$4, "uniqueBlocks"=$5, "ctaText"=$6, "priceRange"=$7, "updatedAt"=NOW()
     WHERE id=$8`,
    [JSON.stringify(strategyBrief), targetWordCount, layoutVariant,
     JSON.stringify(clusterMapping), uniqueBlocks, ctaText, priceRange, generationId]
  );

  return strategyBrief;
}

async function determineCluster(pageType, citySlug) {
  if (pageType === 'ORTS_LP') {
    const city = citySlug ? await queryOne('SELECT * FROM city_profiles WHERE slug = $1', [citySlug]) : null;
    if (city?.tier === 1) return { pillar: '/schrank-nach-mass-ratgeber', type: 'direct_cluster', siblings: [] };
    return { pillar: '/schrank-nach-mass-ratgeber', type: 'satellite', parentCity: null };
  }
  return { pillar: '/schrank-nach-mass-ratgeber', type: 'cluster' };
}

function determineUniqueBlocks(pageType, city) {
  const blocks = ['vergleichstabelle_vs_konfigurator', 'differenzierung_echte_schreinerei'];
  if (city?.uniqueValueAdd) blocks.push('city_unique_' + city.slug);
  if (pageType === 'ORTS_LP') blocks.push('video_call_erklaerung');
  return blocks;
}

function buildContextualCTA(pageType, cityName, product) {
  if (pageType === 'ORTS_LP' && cityName) return `Jetzt Schrank in ${cityName} planen — Preis sofort erfahren`;
  if (product) return `Jetzt deinen ${product} planen — Preis sofort erfahren`;
  return 'Jetzt deinen Schrank planen — Preis sofort erfahren';
}

function buildPriceRange(product) {
  const prices = {
    'Dachschrägenschrank': '3m Schrank mit Schubladen, Kleiderstange, Einlegeböden — Standard ab 2.900€, Premium ab 4.500€, jeweils inkl. Aufmaß und Montage',
    'Begehbarer Kleiderschrank': 'Kompletter begehbarer Kleiderschrank — Standard ab 4.500€, Premium ab 7.500€, inkl. LED-Beleuchtung, Aufmaß und Montage',
    'Kleiderschrank': '3m Kleiderschrank mit Innenausstattung — Standard ab 2.500€, Premium ab 4.000€, inkl. Aufmaß und Montage',
    'Garderobe': 'Maßgefertigte Garderobe mit Sitzbank — Standard ab 2.200€, Premium ab 3.800€, inkl. Aufmaß und Montage',
    'Stauraumschrank': 'Raumhoher Einbauschrank — Standard ab 2.200€, Premium ab 3.500€, inkl. Aufmaß und Montage',
    'Treppenschrank': 'Schrank unter der Treppe — Standard ab 1.800€, Premium ab 3.200€, inkl. Aufmaß und Montage',
    'Waschmaschinenschrank': 'Hauswirtschaftsschrank — Standard ab 1.500€, Premium ab 2.800€, inkl. Aufmaß und Montage',
  };
  return prices[product] || 'Maßgefertigter Schrank — ab 2.200€ inkl. Aufmaß, Fertigung und Montage';
}

function analyzeCompetitorGaps(competitorData) {
  if (!competitorData) return [];
  const gaps = [];
  if (!competitorData.some(c => c?.hasSchema)) gaps.push('Kein Wettbewerber hat Schema.org');
  if (!competitorData.some(c => c?.content?.includes('€'))) gaps.push('Kein Wettbewerber zeigt Preise');
  if (!competitorData.some(c => c?.content?.includes('FAQ'))) gaps.push('Kein Wettbewerber hat FAQ-Section');
  return gaps;
}

async function suggestInternalLinks(pageType, citySlug, product) {
  const links = [
    { url: '/termin', anchor: 'Jetzt Termin buchen', type: 'cta' },
    { url: '/schrank-nach-mass-ratgeber', anchor: 'Kompletter Ratgeber', type: 'pillar' },
    { url: '/was-kostet-ein-einbauschrank', anchor: 'Was kostet ein Einbauschrank?', type: 'pillar' },
  ];
  if (product) {
    const slug = product.toLowerCase().replace(/\s+/g, '-').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
    links.push({ url: `/${slug}`, anchor: product, type: 'product' });
  }
  return links;
}

// ══════════════════════════════════════════
// STUFE 3: RAG RETRIEVAL
// ══════════════════════════════════════════

async function runRetrieval(generationId) {
  const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);

  const searchQuery = [gen.primaryKeyword, gen.targetCity, gen.targetProduct, gen.pageType].filter(Boolean).join(' ');
  const queryEmbedding = await createEmbedding(searchQuery);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const embCount = await queryOne(`SELECT COUNT(*)::int as count FROM knowledge_chunks WHERE embedding IS NOT NULL AND "isActive" = true`);

  let chunks = [];
  if (embCount.count > 0) {
    try {
      chunks = await queryAll(
        `SELECT * FROM search_weighted($1::vector, $2, $3, $4)`,
        [embeddingStr, gen.pageType, gen.targetCity, 12]
      );
    } catch (e) {
      console.error('search_weighted failed, fallback:', e.message);
      chunks = await queryAll(
        `SELECT id, category, subcategory, title, content, metadata, 0.5::float as similarity, 'fallback'::text as reason
         FROM knowledge_chunks WHERE "isActive" = true ORDER BY category LIMIT 12`
      );
    }
  } else {
    console.warn('⚠️ No embeddings! Using category fallback.');
    chunks = await queryAll(
      `SELECT id, category, subcategory, title, content, metadata, 0.5::float as similarity, 'no_embeddings'::text as reason
       FROM knowledge_chunks WHERE "isActive" = true ORDER BY category LIMIT 12`
    );
  }

  const seen = new Set();
  const uniqueChunks = chunks.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

  for (const chunk of uniqueChunks) {
    await query(
      `INSERT INTO chunk_usage (id, "generationId", "chunkId", "relevanceScore", "selectionReason")
       VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [generationId, chunk.id, chunk.similarity, chunk.reason]
    );
  }

  await query(`UPDATE generations SET status='GENERATING', "updatedAt"=NOW() WHERE id=$1`, [generationId]);
  return uniqueChunks;
}

async function createEmbedding(text) {
  const resp = await getOpenAI().embeddings.create({ model: 'text-embedding-3-small', input: text.slice(0, 8000) });
  return resp.data[0].embedding;
}

// ══════════════════════════════════════════
// STUFE 4: GENERATION
// ══════════════════════════════════════════

async function runGeneration(generationId, chunks) {
  const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);
  const startTime = Date.now();

  const contextBlocks = chunks.map((c, i) =>
    `--- CHUNK ${i + 1} [${c.category}${c.subcategory ? ':' + c.subcategory : ''}] (${((c.similarity || 0) * 100).toFixed(0)}%) ---\n${c.content}`
  ).join('\n\n');

  const systemPrompt = PROMPTS.buildSystemPrompt(gen);
  const userPrompt = PROMPTS.buildUserPrompt(gen, contextBlocks);

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    max_tokens: 12000, temperature: 0.7,
  });

  const outputContent = completion.choices[0].message.content;
  const tokensUsed = completion.usage?.total_tokens || 0;

  let outputSchema = null;
  try {
    const sc = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPTS.SCHEMA_SYSTEM },
        { role: 'user', content: PROMPTS.buildSchemaPrompt(gen, outputContent) }
      ],
      max_tokens: 3000, temperature: 0.2,
    });
    outputSchema = JSON.parse(sc.choices[0].message.content.replace(/```json\n?|```/g, '').trim());
  } catch (e) { console.error('Schema gen failed:', e.message); }

  let outputMeta = {};
  try {
    const mc = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Erstelle Meta-Title (max 60 Zeichen) und Meta-Description (max 155 Zeichen). Antwort als JSON: {"title":"...","description":"..."}' },
        { role: 'user', content: outputContent.slice(0, 2000) }
      ],
      max_tokens: 200, temperature: 0.3,
    });
    outputMeta = JSON.parse(mc.choices[0].message.content.replace(/```json\n?|```/g, '').trim());
  } catch (e) { outputMeta = { title: gen.primaryKeyword, description: '' }; }

  outputMeta.wordCount = outputContent.split(/\s+/).length;
  const durationMs = Date.now() - startTime;

  await query(
    `UPDATE generations SET
      status='BOARD_REVIEW', "outputContent"=$1, "outputSchema"=$2, "outputMeta"=$3,
      "tokensUsed"=$4, "durationMs"=$5, "costUsd"=$6, "updatedAt"=NOW()
     WHERE id=$7`,
    [outputContent, JSON.stringify(outputSchema), JSON.stringify(outputMeta),
     tokensUsed, durationMs, tokensUsed * 0.000005, generationId]
  );

  return { outputContent, outputSchema, outputMeta, wordCount: outputMeta.wordCount, tokensUsed, durationMs };
}

// ══════════════════════════════════════════
// STUFE 5: BOARD REVIEW
// ══════════════════════════════════════════

async function runBoardReview(generationId) {
  const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);
  const boardPrompt = PROMPTS.buildBoardReviewPrompt(gen);

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PROMPTS.BOARD_SYSTEM },
      { role: 'user', content: boardPrompt }
    ],
    max_tokens: 4000, temperature: 0.3,
  });

  const boardOutput = completion.choices[0].message.content;
  let boardScores = { raw: boardOutput };
  try {
    boardScores.passCount = (boardOutput.match(/✅/g) || []).length;
    boardScores.warnCount = (boardOutput.match(/⚠️/g) || []).length;
    boardScores.failCount = (boardOutput.match(/❌/g) || []).length;
    boardScores.sandraK = boardOutput.match(/Sandra.*?(JA|NEIN)/i)?.[1]?.toUpperCase() === 'JA';
    boardScores.thomasR = boardOutput.match(/Thomas.*?(JA|NEIN)/i)?.[1]?.toUpperCase() === 'JA';
  } catch (e) { /* parsing failed */ }

  const boardPass = (boardScores.failCount || 0) < 3 &&
                    (boardScores.sandraK !== false) &&
                    (boardScores.thomasR !== false);

  await query(
    `UPDATE generations SET status=$1, "boardScores"=$2, "boardPass"=$3, "updatedAt"=NOW() WHERE id=$4`,
    [boardPass ? 'APPROVED' : 'REJECTED', JSON.stringify(boardScores), boardPass, generationId]
  );

  return { boardPass, boardScores, boardOutput };
}

// ══════════════════════════════════════════
// STUFE 6: EXPORT
// ══════════════════════════════════════════

async function runExport(generationId) {
  const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);
  const exportPrompt = PROMPTS.buildExportPrompt(gen);

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PROMPTS.EXPORT_SYSTEM },
      { role: 'user', content: exportPrompt }
    ],
    max_tokens: 12000, temperature: 0.2,
  });

  const exportHtml = completion.choices[0].message.content;

  await query(
    `UPDATE generations SET status='EXPORTED', "exportHtml"=$1, "exportFormat"='generateblocks', "updatedAt"=NOW() WHERE id=$2`,
    [exportHtml, generationId]
  );

  try {
    const r = await fetch('https://schreinerhelden.de/termin');
    if ((await r.text()).includes('Lorem ipsum')) console.warn('⚠️ /termin hat Lorem Ipsum!');
  } catch (e) { /* not critical */ }

  return { exportHtml };
}

// ══════════════════════════════════════════
// FULL PIPELINE ORCHESTRATOR
// ══════════════════════════════════════════

async function runFullPipeline({ generationId, pageType, primaryKeyword, targetCity, targetProduct, userId }) {
  if (!generationId) {
    const gen = await queryOne(
      `INSERT INTO generations (id, "pageType", "primaryKeyword", "targetCity", "targetProduct", status, "createdBy", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'INTELLIGENCE', $5, NOW(), NOW()) RETURNING id`,
      [pageType, primaryKeyword, targetCity, targetProduct, userId]
    );
    generationId = gen.id;
  }

  try {
    await runIntelligence(generationId);
    const strategy = await runStrategy(generationId);
    if (strategy.rejected) return { id: generationId, status: 'REJECTED', reason: strategy.reason };

    const chunks = await runRetrieval(generationId);
    await runGeneration(generationId, chunks);

    const board = await runBoardReview(generationId);

    if (!board.boardPass) {
      const g = await queryOne('SELECT "boardRound" FROM generations WHERE id = $1', [generationId]);
      if ((g.boardRound || 1) < 2) {
        await query(`UPDATE generations SET "boardRound"=2, status='GENERATING', "updatedAt"=NOW() WHERE id=$1`, [generationId]);
        await runGeneration(generationId, chunks);
        const b2 = await runBoardReview(generationId);
        if (!b2.boardPass) return await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);
      }
    }

    const gf = await queryOne('SELECT "boardPass" FROM generations WHERE id = $1', [generationId]);
    if (gf.boardPass) await runExport(generationId);

    const result = await queryOne('SELECT * FROM generations WHERE id = $1', [generationId]);
    const cu = await queryAll(
      `SELECT cu.*, kc.category as "chunkCategory", kc.title as "chunkTitle"
       FROM chunk_usage cu LEFT JOIN knowledge_chunks kc ON cu."chunkId" = kc.id
       WHERE cu."generationId" = $1`, [generationId]
    );
    result.chunksUsed = cu.map(c => ({ ...c, chunk: { id: c.chunkId, category: c.chunkCategory, title: c.chunkTitle } }));
    return result;
  } catch (err) {
    await query(
      `UPDATE generations SET status='REJECTED', "boardScores"=$1, "updatedAt"=NOW() WHERE id=$2`,
      [JSON.stringify({ error: err.message }), generationId]
    );
    throw err;
  }
}

module.exports = {
  runFullPipeline, runIntelligence, runStrategy, runRetrieval, runGeneration,
  runBoardReview, runExport, createEmbedding, getOpenAI,
};
