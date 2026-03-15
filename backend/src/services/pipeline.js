// ============================================
// MEOS:HELDEN — 6-Stage Pipeline Service
// The brain: Intelligence → Strategy → RAG → Generation → Board → Export
// All 34 Board improvements integrated
// ============================================

const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROMPTS = require('../prompts/heldenformel');
const { fetchSERP, fetchKeywordVolumes, fetchOnPage } = require('./dataforseo');
const { fetchGSCData } = require('./gsc');

// ══════════════════════════════════════════
// STUFE 1: INTELLIGENCE
// ══════════════════════════════════════════

async function runIntelligence(generationId) {
  const gen = await prisma.generation.findUnique({ where: { id: generationId } });
  const city = gen.targetCity ? await prisma.cityProfile.findUnique({ where: { slug: gen.targetCity } }) : null;
  
  // 1a. SERP Analysis
  const serpQuery = [gen.primaryKeyword, city?.name].filter(Boolean).join(' ');
  const geoCode = city?.geoCode || '1003854'; // BaWü fallback
  let serpData = null;
  try {
    serpData = await fetchSERP(serpQuery, geoCode);
  } catch (e) { console.error('SERP fetch failed:', e.message); }

  // 1b. Keyword Cluster — build long-tail variants
  const keywordVariants = buildKeywordVariants(gen.primaryKeyword, city?.name);
  let keywordCluster = null;
  try {
    keywordCluster = await fetchKeywordVolumes(keywordVariants, geoCode);
  } catch (e) { console.error('Keyword volume fetch failed:', e.message); }

  // 1c. Competitor Scan — Top 3 from SERP
  let competitorData = null;
  if (serpData?.items?.length > 0) {
    const top3Urls = serpData.items.slice(0, 3).map(i => i.url).filter(Boolean);
    try {
      competitorData = await Promise.all(top3Urls.map(url => fetchOnPage(url)));
    } catch (e) { console.error('Competitor scan failed:', e.message); }
  }

  // 1d. GSC Check
  let gscData = null;
  try {
    gscData = await fetchGSCData(gen.primaryKeyword, city?.name);
  } catch (e) { console.error('GSC fetch failed:', e.message); }

  // 1e. Intent Classification (Board R4)
  const searchIntent = classifyIntent(serpData, gen.primaryKeyword, city?.name);

  // 1f. Top-3 average word count (Board R5: we target 15% above)
  const topThreeAvgWords = competitorData
    ? Math.round(competitorData.reduce((sum, c) => sum + (c?.wordCount || 0), 0) / competitorData.length)
    : 1500;

  // Update generation
  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: 'STRATEGY',
      serpData, keywordCluster, competitorData, gscData,
      searchIntent, topThreeAvgWords,
      secondaryKeywords: keywordCluster
        ? keywordCluster.filter(k => k.volume > 20).slice(0, 8).map(k => k.keyword)
        : [],
    }
  });

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
  base.push(
    `${keyword} kosten`, `${keyword} erfahrung`, `${keyword} selber planen`,
    `${keyword} vom schreiner`, `${keyword} vs konfigurator`,
  );
  return [...new Set(base)].slice(0, 20);
}

function classifyIntent(serpData, keyword, cityName) {
  // Board R4: Classify search intent
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
  const gen = await prisma.generation.findUnique({ where: { id: generationId } });
  const city = gen.targetCity ? await prisma.cityProfile.findUnique({ where: { slug: gen.targetCity } }) : null;

  // Board R4: If no local intent detected, don't create Orts-LP
  if (gen.pageType === 'ORTS_LP' && gen.searchIntent === 'national') {
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: 'REJECTED', boardScores: { warning: 'Intent ist national, nicht lokal. Pillar-Content empfohlen statt Orts-LP.' } }
    });
    return { rejected: true, reason: 'National intent — use Pillar instead' };
  }

  // Target word count: 15% above top-3 average (Board R5)
  const targetWordCount = Math.max(
    gen.pageType === 'PILLAR' ? 2500 : gen.pageType === 'BLOG' ? 1200 : 1500,
    Math.round((gen.topThreeAvgWords || 1500) * 1.15)
  );

  // Layout variant (Board R1: 3 variable layouts)
  const layoutVariants = ['LAYOUT_A', 'LAYOUT_B', 'LAYOUT_C'];
  const layoutVariant = layoutVariants[Math.floor(Math.random() * 3)];

  // Cluster mapping (Board R2: hierarchical)
  const clusterMapping = await determineCluster(gen.pageType, gen.targetCity, gen.primaryKeyword);

  // Unique blocks that competitors don't have (Board R4: min 2)
  const uniqueBlocks = determineUniqueBlocks(gen.pageType, city);

  // Contextual CTA (Board R2)
  const ctaText = buildContextualCTA(gen.pageType, city?.name, gen.targetProduct);

  // Price range (Board R4: range, not just entry price)
  const priceRange = buildPriceRange(gen.targetProduct);

  // People Also Ask → FAQ seeds
  const paaQuestions = gen.serpData?.items
    ?.filter(i => i.type === 'people_also_ask')
    ?.map(i => i.title) || [];

  const strategyBrief = {
    pageType: gen.pageType,
    layoutVariant,
    targetWordCount,
    primaryKeyword: gen.primaryKeyword,
    secondaryKeywords: gen.secondaryKeywords,
    city: city?.name,
    clusterMapping,
    uniqueBlocks,
    ctaText,
    priceRange,
    paaQuestions,
    competitorGaps: analyzeCompetitorGaps(gen.competitorData),
    internalLinks: await suggestInternalLinks(gen.pageType, gen.targetCity, gen.targetProduct),
  };

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: 'RETRIEVAL',
      strategyBrief, targetWordCount, layoutVariant,
      clusterMapping, uniqueBlocks, ctaText, priceRange,
    }
  });

  return strategyBrief;
}

async function determineCluster(pageType, citySlug, keyword) {
  // Board R2: Tier 1 cities get own Pillar connection
  const clusters = await prisma.clusterMap.findMany();
  
  if (pageType === 'ORTS_LP') {
    const city = citySlug ? await prisma.cityProfile.findUnique({ where: { slug: citySlug } }) : null;
    if (city?.tier === 1) {
      return { pillar: '/schrank-nach-mass-ratgeber', type: 'direct_cluster', siblings: [] };
    }
    // Tier 2/3: satellite to nearest Tier 1
    return { pillar: '/schrank-nach-mass-ratgeber', type: 'satellite', parentCity: null };
  }
  
  return { pillar: '/schrank-nach-mass-ratgeber', type: 'cluster' };
}

function determineUniqueBlocks(pageType, city) {
  // Board R4: 2+ blocks no competitor has
  const blocks = ['vergleichstabelle_vs_konfigurator', 'differenzierung_echte_schreinerei'];
  if (city?.uniqueValueAdd) blocks.push('city_unique_' + city.slug);
  if (pageType === 'ORTS_LP') blocks.push('video_call_erklaerung');
  return blocks;
}

function buildContextualCTA(pageType, cityName, product) {
  // Board R2: contextual, not generic
  if (pageType === 'ORTS_LP' && cityName) return `Jetzt Schrank in ${cityName} planen — Preis sofort erfahren`;
  if (product) return `Jetzt deinen ${product} planen — Preis sofort erfahren`;
  return 'Jetzt deinen Schrank planen — Preis sofort erfahren';
}

function buildPriceRange(product) {
  // Board R4: range, not just entry + include what you get
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
  const hasSchema = competitorData.some(c => c?.hasSchema);
  if (!hasSchema) gaps.push('Kein Wettbewerber hat Schema.org — große Chance');
  const hasPricing = competitorData.some(c => c?.content?.includes('€') || c?.content?.includes('Preis'));
  if (!hasPricing) gaps.push('Kein Wettbewerber zeigt Preise — Differenzierung durch Transparenz');
  const hasFaq = competitorData.some(c => c?.content?.includes('FAQ') || c?.content?.includes('Häufige Fragen'));
  if (!hasFaq) gaps.push('Kein Wettbewerber hat FAQ-Section — AEO-Chance');
  return gaps;
}

async function suggestInternalLinks(pageType, citySlug, product) {
  const links = [{ url: '/termin', anchor: 'Jetzt Termin buchen', type: 'cta' }];
  links.push({ url: '/schrank-nach-mass-ratgeber', anchor: 'Kompletter Ratgeber', type: 'pillar' });
  links.push({ url: '/was-kostet-ein-einbauschrank', anchor: 'Was kostet ein Einbauschrank?', type: 'pillar' });
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
  const gen = await prisma.generation.findUnique({ where: { id: generationId } });
  
  const searchQuery = [gen.primaryKeyword, gen.targetCity, gen.targetProduct, gen.pageType].filter(Boolean).join(' ');
  const queryEmbedding = await createEmbedding(searchQuery);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const chunks = await prisma.$queryRawUnsafe(
    `SELECT * FROM search_weighted($1::vector, $2, $3, $4)`,
    embeddingStr, gen.pageType, gen.targetCity, 12
  );

  // Deduplicate
  const seen = new Set();
  const uniqueChunks = chunks.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

  // Log chunk usage
  for (const chunk of uniqueChunks) {
    await prisma.chunkUsage.create({
      data: { generationId, chunkId: chunk.id, relevanceScore: chunk.similarity, selectionReason: chunk.reason }
    });
  }

  await prisma.generation.update({ where: { id: generationId }, data: { status: 'GENERATING' } });
  return uniqueChunks;
}

async function createEmbedding(text) {
  const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text.slice(0, 8000) });
  return resp.data[0].embedding;
}

// ══════════════════════════════════════════
// STUFE 4: GENERATION
// ══════════════════════════════════════════

async function runGeneration(generationId, chunks) {
  const gen = await prisma.generation.findUnique({ where: { id: generationId } });
  const startTime = Date.now();

  // Build context from chunks
  const contextBlocks = chunks.map((c, i) =>
    `--- CHUNK ${i + 1} [${c.category}${c.subcategory ? ':' + c.subcategory : ''}] (${(c.similarity * 100).toFixed(0)}%) ---\n${c.content}`
  ).join('\n\n');

  // Build the generation prompt with ALL board improvements
  const systemPrompt = PROMPTS.buildSystemPrompt(gen);
  const userPrompt = PROMPTS.buildUserPrompt(gen, contextBlocks);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 6000,
    temperature: 0.7,
  });

  const outputContent = completion.choices[0].message.content;
  const tokensUsed = completion.usage?.total_tokens || 0;

  // Generate Schema.org separately
  let outputSchema = null;
  try {
    const schemaCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPTS.SCHEMA_SYSTEM },
        { role: 'user', content: PROMPTS.buildSchemaPrompt(gen, outputContent) }
      ],
      max_tokens: 3000, temperature: 0.2,
    });
    const raw = schemaCompletion.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
    outputSchema = JSON.parse(raw);
  } catch (e) { console.error('Schema gen failed:', e.message); }

  // Generate Meta
  let outputMeta = {};
  try {
    const metaCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Erstelle Meta-Title (max 60 Zeichen) und Meta-Description (max 155 Zeichen). Antwort als JSON: {"title":"...","description":"..."}' },
        { role: 'user', content: outputContent.slice(0, 2000) }
      ],
      max_tokens: 200, temperature: 0.3,
    });
    const metaRaw = metaCompletion.choices[0].message.content.replace(/```json\n?|```/g, '').trim();
    outputMeta = JSON.parse(metaRaw);
  } catch (e) { outputMeta = { title: gen.primaryKeyword, description: '' }; }

  const wordCount = outputContent.split(/\s+/).length;
  outputMeta.wordCount = wordCount;

  const durationMs = Date.now() - startTime;

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: 'BOARD_REVIEW',
      outputContent, outputSchema, outputMeta,
      tokensUsed, durationMs,
      costUsd: tokensUsed * 0.000005, // rough estimate
    }
  });

  return { outputContent, outputSchema, outputMeta, wordCount, tokensUsed, durationMs };
}

// ══════════════════════════════════════════
// STUFE 5: BOARD REVIEW
// ══════════════════════════════════════════

async function runBoardReview(generationId) {
  const gen = await prisma.generation.findUnique({ where: { id: generationId } });
  
  const boardPrompt = PROMPTS.buildBoardReviewPrompt(gen);
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PROMPTS.BOARD_SYSTEM },
      { role: 'user', content: boardPrompt }
    ],
    max_tokens: 4000,
    temperature: 0.3,
  });

  const boardOutput = completion.choices[0].message.content;
  
  // Parse scores (try to extract structured data)
  let boardScores = { raw: boardOutput };
  try {
    // Try to extract pass/fail counts
    const passCount = (boardOutput.match(/✅/g) || []).length;
    const warnCount = (boardOutput.match(/⚠️/g) || []).length;
    const failCount = (boardOutput.match(/❌/g) || []).length;
    boardScores.passCount = passCount;
    boardScores.warnCount = warnCount;
    boardScores.failCount = failCount;
    
    // Check test customers
    const sandraMatch = boardOutput.match(/Sandra.*?(JA|NEIN)/i);
    const thomasMatch = boardOutput.match(/Thomas.*?(JA|NEIN)/i);
    boardScores.sandraK = sandraMatch?.[1]?.toUpperCase() === 'JA';
    boardScores.thomasR = thomasMatch?.[1]?.toUpperCase() === 'JA';
  } catch (e) { /* parsing failed, use raw */ }

  // Board R1: If ≥3 FAIL → re-generate
  const boardPass = (boardScores.failCount || 0) < 3 &&
                    (boardScores.sandraK !== false) &&
                    (boardScores.thomasR !== false);

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: boardPass ? 'APPROVED' : 'REJECTED',
      boardScores,
      boardPass,
    }
  });

  return { boardPass, boardScores, boardOutput };
}

// ══════════════════════════════════════════
// STUFE 6: EXPORT
// ══════════════════════════════════════════

async function runExport(generationId) {
  const gen = await prisma.generation.findUnique({ where: { id: generationId } });
  
  // Convert Markdown to GenerateBlocks-compatible HTML (Board R4)
  const exportPrompt = PROMPTS.buildExportPrompt(gen);
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: PROMPTS.EXPORT_SYSTEM },
      { role: 'user', content: exportPrompt }
    ],
    max_tokens: 6000,
    temperature: 0.2,
  });

  const exportHtml = completion.choices[0].message.content;

  await prisma.generation.update({
    where: { id: generationId },
    data: { status: 'EXPORTED', exportHtml, exportFormat: 'generateblocks' }
  });

  // Board R4: Check CTA target (/termin)
  try {
    const terminCheck = await fetch('https://schreinerhelden.de/termin');
    const terminHtml = await terminCheck.text();
    if (terminHtml.includes('Lorem ipsum')) {
      console.warn('⚠️ WARNUNG: /termin enthält noch Lorem Ipsum!');
    }
  } catch (e) { /* Can't reach, not critical */ }

  return { exportHtml };
}

// ══════════════════════════════════════════
// FULL PIPELINE ORCHESTRATOR
// ══════════════════════════════════════════

async function runFullPipeline({ pageType, primaryKeyword, targetCity, targetProduct, userId }) {
  // Create generation record
  const gen = await prisma.generation.create({
    data: {
      pageType, primaryKeyword, targetCity, targetProduct,
      status: 'INTELLIGENCE', createdBy: userId,
    }
  });

  try {
    // Stufe 1
    const intelligence = await runIntelligence(gen.id);
    
    // Stufe 2
    const strategy = await runStrategy(gen.id);
    if (strategy.rejected) return { id: gen.id, status: 'REJECTED', reason: strategy.reason };
    
    // Stufe 3
    const chunks = await runRetrieval(gen.id);
    
    // Stufe 4
    const content = await runGeneration(gen.id, chunks);
    
    // Stufe 5
    const board = await runBoardReview(gen.id);
    
    // If board failed, try ONE re-generation (Board R1: max 1 retry)
    if (!board.boardPass && gen.boardRound < 2) {
      await prisma.generation.update({ where: { id: gen.id }, data: { boardRound: 2, status: 'GENERATING' } });
      const content2 = await runGeneration(gen.id, chunks);
      const board2 = await runBoardReview(gen.id);
      if (!board2.boardPass) {
        return await prisma.generation.findUnique({ where: { id: gen.id } });
      }
    }

    // Stufe 6
    if (board.boardPass || gen.boardRound === 2) {
      await runExport(gen.id);
    }

    return await prisma.generation.findUnique({
      where: { id: gen.id },
      include: { chunksUsed: { include: { chunk: { select: { id: true, category: true, title: true } } } } }
    });
  } catch (err) {
    await prisma.generation.update({ where: { id: gen.id }, data: { status: 'REJECTED', boardScores: { error: err.message } } });
    throw err;
  }
}

module.exports = {
  runFullPipeline,
  runIntelligence, runStrategy, runRetrieval, runGeneration,
  runBoardReview, runExport,
  createEmbedding,
};
