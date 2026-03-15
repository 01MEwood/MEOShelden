// ============================================
// MEOS:HELDEN — Pipeline Routes
// POST /api/pipeline/run → Full 6-stage pipeline
// ============================================

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const pipeline = require('../services/pipeline');

const prisma = new PrismaClient();

// Run full pipeline
router.post('/run', async (req, res) => {
  try {
    const { pageType, primaryKeyword, targetCity, targetProduct } = req.body;

    if (!pageType || !primaryKeyword) {
      return res.status(400).json({ error: 'pageType und primaryKeyword sind Pflichtfelder.' });
    }

    const valid = ['ORTS_LP', 'PRODUCT_PAGE', 'BLOG', 'PILLAR'];
    if (!valid.includes(pageType)) {
      return res.status(400).json({ error: `pageType muss einer von: ${valid.join(', ')}` });
    }

    // Start pipeline (async — returns immediately with generation ID)
    const gen = await prisma.generation.create({
      data: {
        pageType, primaryKeyword,
        targetCity: targetCity || null,
        targetProduct: targetProduct || null,
        status: 'INTELLIGENCE',
        createdBy: req.user?.id || 'anonymous',
      }
    });

    // Run async
    pipeline.runFullPipeline({
      pageType, primaryKeyword,
      targetCity: targetCity || null,
      targetProduct: targetProduct || null,
      userId: req.user?.id,
    }).catch(err => {
      console.error(`Pipeline ${gen.id} failed:`, err);
    });

    // But we also update the ID
    await prisma.generation.update({ where: { id: gen.id }, data: {} });

    res.json({ success: true, id: gen.id, message: 'Pipeline gestartet. Nutze GET /api/pipeline/:id für Status.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run pipeline SYNC (waits for completion — for smaller jobs)
router.post('/run-sync', async (req, res) => {
  try {
    const { pageType, primaryKeyword, targetCity, targetProduct } = req.body;

    if (!pageType || !primaryKeyword) {
      return res.status(400).json({ error: 'pageType und primaryKeyword sind Pflichtfelder.' });
    }

    const result = await pipeline.runFullPipeline({
      pageType, primaryKeyword,
      targetCity: targetCity || null,
      targetProduct: targetProduct || null,
      userId: req.user?.id,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get generation status + details
router.get('/:id', async (req, res) => {
  try {
    const gen = await prisma.generation.findUnique({
      where: { id: req.params.id },
      include: {
        chunksUsed: { include: { chunk: { select: { id: true, category: true, title: true } } } },
        city: true,
      }
    });
    if (!gen) return res.status(404).json({ error: 'Nicht gefunden.' });
    res.json({ success: true, data: gen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all generations
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, pageType, city } = req.query;
    const where = {};
    if (status) where.status = status;
    if (pageType) where.pageType = pageType;
    if (city) where.targetCity = city;

    const [generations, total] = await Promise.all([
      prisma.generation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        select: {
          id: true, pageType: true, status: true, primaryKeyword: true,
          targetCity: true, targetProduct: true, outputMeta: true,
          boardPass: true, boardScores: true, tokensUsed: true,
          costUsd: true, durationMs: true, createdAt: true,
        }
      }),
      prisma.generation.count({ where })
    ]);

    res.json({ success: true, data: generations, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-run board review
router.post('/:id/review', async (req, res) => {
  try {
    const result = await pipeline.runBoardReview(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export to WordPress
router.post('/:id/export', async (req, res) => {
  try {
    const result = await pipeline.runExport(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
router.get('/stats/overview', async (req, res) => {
  try {
    const [total, approved, exported, published, byType, byCity] = await Promise.all([
      prisma.generation.count(),
      prisma.generation.count({ where: { status: 'APPROVED' } }),
      prisma.generation.count({ where: { status: 'EXPORTED' } }),
      prisma.generation.count({ where: { status: 'PUBLISHED' } }),
      prisma.generation.groupBy({ by: ['pageType'], _count: true }),
      prisma.generation.groupBy({ by: ['targetCity'], _count: true, where: { targetCity: { not: null } } }),
    ]);

    const chunkCount = await prisma.knowledgeChunk.count({ where: { isActive: true } });
    const cityCount = await prisma.cityProfile.count();

    res.json({
      success: true, data: {
        total, approved, exported, published,
        knowledgeChunks: chunkCount, cities: cityCount,
        byType: byType.map(t => ({ type: t.pageType, count: t._count })),
        byCity: byCity.map(c => ({ city: c.targetCity, count: c._count })),
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
