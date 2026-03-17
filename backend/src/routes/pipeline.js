// ============================================
// MEOS:HELDEN — Pipeline Routes (Raw SQL)
// ============================================

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../db');
const pipeline = require('../services/pipeline');

// Dashboard stats — MUST be before /:id to avoid matching "stats" as an id
router.get('/stats/overview', async (req, res) => {
  try {
    const [total, approved, exported, published, chunkCount, cityCount] = await Promise.all([
      queryOne('SELECT COUNT(*)::int as count FROM generations'),
      queryOne(`SELECT COUNT(*)::int as count FROM generations WHERE status='APPROVED'`),
      queryOne(`SELECT COUNT(*)::int as count FROM generations WHERE status='EXPORTED'`),
      queryOne(`SELECT COUNT(*)::int as count FROM generations WHERE status='PUBLISHED'`),
      queryOne('SELECT COUNT(*)::int as count FROM knowledge_chunks WHERE "isActive"=true'),
      queryOne('SELECT COUNT(*)::int as count FROM city_profiles'),
    ]);

    const byType = await queryAll(`SELECT "pageType" as type, COUNT(*)::int as count FROM generations GROUP BY "pageType"`);
    const byCity = await queryAll(`SELECT "targetCity" as city, COUNT(*)::int as count FROM generations WHERE "targetCity" IS NOT NULL GROUP BY "targetCity"`);

    res.json({
      success: true, data: {
        total: total.count, approved: approved.count, exported: exported.count, published: published.count,
        knowledgeChunks: chunkCount.count, cities: cityCount.count,
        byType, byCity,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Run async pipeline
router.post('/run', async (req, res) => {
  try {
    const { pageType, primaryKeyword, targetCity, targetProduct } = req.body;
    if (!pageType || !primaryKeyword) return res.status(400).json({ error: 'pageType und primaryKeyword sind Pflichtfelder.' });

    const valid = ['ORTS_LP', 'PRODUCT_PAGE', 'BLOG', 'PILLAR'];
    if (!valid.includes(pageType)) return res.status(400).json({ error: `pageType muss einer von: ${valid.join(', ')}` });

    const gen = await queryOne(
      `INSERT INTO generations (id, "pageType", "primaryKeyword", "targetCity", "targetProduct", status, "createdBy", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'INTELLIGENCE', $5, NOW(), NOW()) RETURNING id`,
      [pageType, primaryKeyword, targetCity || null, targetProduct || null, req.user?.id || 'anonymous']
    );

    // Run async
    pipeline.runFullPipeline({
      generationId: gen.id, pageType, primaryKeyword,
      targetCity: targetCity || null, targetProduct: targetProduct || null,
      userId: req.user?.id,
    }).catch(err => console.error(`Pipeline ${gen.id} failed:`, err));

    res.json({ success: true, id: gen.id, message: 'Pipeline gestartet. Nutze GET /api/pipeline/:id für Status.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Run sync pipeline
router.post('/run-sync', async (req, res) => {
  try {
    const { pageType, primaryKeyword, targetCity, targetProduct } = req.body;
    if (!pageType || !primaryKeyword) return res.status(400).json({ error: 'pageType und primaryKeyword sind Pflichtfelder.' });

    const result = await pipeline.runFullPipeline({
      pageType, primaryKeyword,
      targetCity: targetCity || null, targetProduct: targetProduct || null,
      userId: req.user?.id,
    });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get generation by ID
router.get('/:id', async (req, res) => {
  try {
    const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [req.params.id]);
    if (!gen) return res.status(404).json({ error: 'Nicht gefunden.' });

    // Get chunks used
    const chunksUsed = await queryAll(
      `SELECT cu.*, kc.category as "chunkCategory", kc.title as "chunkTitle"
       FROM chunk_usage cu LEFT JOIN knowledge_chunks kc ON cu."chunkId" = kc.id
       WHERE cu."generationId" = $1`,
      [req.params.id]
    );
    gen.chunksUsed = chunksUsed.map(cu => ({
      ...cu,
      chunk: { id: cu.chunkId, category: cu.chunkCategory, title: cu.chunkTitle },
    }));

    // Get city
    if (gen.targetCity) {
      gen.city = await queryOne('SELECT * FROM city_profiles WHERE slug = $1', [gen.targetCity]);
    }

    res.json({ success: true, data: gen });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List generations
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, pageType, city } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (pageType) { conditions.push(`"pageType" = $${idx++}`); params.push(pageType); }
    if (city) { conditions.push(`"targetCity" = $${idx++}`); params.push(city); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [generations, countRes] = await Promise.all([
      queryAll(
        `SELECT id, "pageType", status, "primaryKeyword", "targetCity", "targetProduct",
                "outputMeta", "boardPass", "boardScores", "tokensUsed", "costUsd", "durationMs", "createdAt"
         FROM generations ${where}
         ORDER BY "createdAt" DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, parseInt(limit), offset]
      ),
      queryOne(`SELECT COUNT(*)::int as total FROM generations ${where}`, params),
    ]);

    res.json({ success: true, data: generations, total: countRes.total, page: parseInt(page), pages: Math.ceil(countRes.total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Re-run board review
router.post('/:id/review', async (req, res) => {
  try {
    const result = await pipeline.runBoardReview(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export
router.post('/:id/export', async (req, res) => {
  try {
    const result = await pipeline.runExport(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
