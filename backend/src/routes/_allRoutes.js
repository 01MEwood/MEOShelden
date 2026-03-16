// ============================================
// MEOS:HELDEN — Supporting Routes (all in one for brevity)
// Split into separate files in production
// ============================================

// ── knowledge.js ──
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const pipeline = require('../services/pipeline');
const prisma = new PrismaClient();

const knowledge = express.Router();

knowledge.get('/', async (req, res) => {
  const { category, subcategory, search, page = 1, limit = 50 } = req.query;
  const where = { isActive: true };
  if (category) where.category = category;
  if (subcategory) where.subcategory = subcategory;
  if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { content: { contains: search, mode: 'insensitive' } }];
  const [chunks, total] = await Promise.all([
    prisma.knowledgeChunk.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page-1)*limit, take: parseInt(limit) }),
    prisma.knowledgeChunk.count({ where })
  ]);
  res.json({ success: true, chunks, total });
});

knowledge.post('/', async (req, res) => {
  const { category, subcategory, title, content, metadata } = req.body;
  if (!category || !title || !content) return res.status(400).json({ error: 'category, title, content erforderlich' });
  // Create + embed
  const chunk = await prisma.knowledgeChunk.create({ data: { category, subcategory, title, content, metadata } });
  const embedding = await pipeline.createEmbedding(`${title}: ${content}`);
  await prisma.$executeRawUnsafe(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, `[${embedding.join(',')}]`, chunk.id);
  res.json({ success: true, data: chunk });
});

knowledge.post('/batch', async (req, res) => {
  const { chunks } = req.body;
  if (!Array.isArray(chunks)) return res.status(400).json({ error: 'chunks Array erforderlich' });
  const results = [];
  for (const c of chunks) {
    try {
      const chunk = await prisma.knowledgeChunk.create({ data: { category: c.category, subcategory: c.subcategory, title: c.title, content: c.content, metadata: c.metadata } });
      const emb = await pipeline.createEmbedding(`${c.title}: ${c.content}`);
      await prisma.$executeRawUnsafe(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, `[${emb.join(',')}]`, chunk.id);
      results.push({ success: true, id: chunk.id, title: c.title });
      await new Promise(r => setTimeout(r, 100));
    } catch (e) { results.push({ success: false, title: c.title, error: e.message }); }
  }
  res.json({ success: true, results, succeeded: results.filter(r=>r.success).length, failed: results.filter(r=>!r.success).length });
});

knowledge.put('/:id', async (req, res) => {
  const { title, content, subcategory, metadata } = req.body;
  const chunk = await prisma.knowledgeChunk.update({ where: { id: req.params.id }, data: { title, content, subcategory, metadata } });
  const emb = await pipeline.createEmbedding(`${title}: ${content}`);
  await prisma.$executeRawUnsafe(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, `[${emb.join(',')}]`, req.params.id);
  res.json({ success: true, data: chunk });
});
// Embed ALL chunks that don't have embeddings yet
knowledge.post('/embed-all', async (req, res) => {
  try {
    const unembedded = await prisma.$queryRawUnsafe(
      `SELECT id, title, content FROM knowledge_chunks WHERE embedding IS NULL AND "isActive" = true`
    );
    if (unembedded.length === 0) {
      return res.json({ success: true, message: 'Alle Chunks haben bereits Embeddings.', total: 0 });
    }
    res.json({ success: true, message: `Starte Embedding für ${unembedded.length} Chunks...`, total: unembedded.length });
    (async () => {
      let success = 0, failed = 0;
      for (const chunk of unembedded) {
        try {
          const emb = await pipeline.createEmbedding(`${chunk.title}: ${chunk.content}`);
          await prisma.$executeRawUnsafe(
            `UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`,
            `[${emb.join(',')}]`, chunk.id
          );
          success++;
          console.log(`  Embedded: ${chunk.title} (${success}/${unembedded.length})`);
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          failed++;
          console.log(`  Failed: ${chunk.title}: ${e.message}`);
        }
      }
      console.log(`Embedding complete: ${success} success, ${failed} failed`);
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

Commit. Dann in PowerShell:
```
cd C:\Users\Video\MEOShelden
git pull
docker build -t mariomeosv40/meoshelden:latest .
docker push mariomeosv40/meoshelden:latest
knowledge.delete('/:id', async (req, res) => {
  await prisma.knowledgeChunk.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true });
});

// ── cities.js ──
const cities = express.Router();

cities.get('/', async (req, res) => {
  const profiles = await prisma.cityProfile.findMany({ orderBy: { priorityScore: 'desc' } });
  res.json({ success: true, data: profiles });
});

cities.get('/:slug', async (req, res) => {
  const city = await prisma.cityProfile.findUnique({ where: { slug: req.params.slug } });
  if (!city) return res.status(404).json({ error: 'Stadt nicht gefunden' });
  res.json({ success: true, data: city });
});

cities.post('/', async (req, res) => {
  const city = await prisma.cityProfile.create({ data: req.body });
  res.json({ success: true, data: city });
});

cities.put('/:slug', async (req, res) => {
  const city = await prisma.cityProfile.update({ where: { slug: req.params.slug }, data: req.body });
  res.json({ success: true, data: city });
});

// ── clusters.js ──
const clusters = express.Router();

clusters.get('/', async (req, res) => {
  const maps = await prisma.clusterMap.findMany({ orderBy: { healthScore: 'desc' } });
  res.json({ success: true, data: maps });
});

clusters.post('/', async (req, res) => {
  const map = await prisma.clusterMap.create({ data: req.body });
  res.json({ success: true, data: map });
});

clusters.put('/:id', async (req, res) => {
  const map = await prisma.clusterMap.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: map });
});

// Health check: count cluster pages per pillar
clusters.post('/check-health', async (req, res) => {
  const maps = await prisma.clusterMap.findMany();
  const alerts = [];
  for (const m of maps) {
    const count = await prisma.generation.count({
      where: { status: { in: ['EXPORTED', 'PUBLISHED'] }, clusterMapping: { path: ['pillar'], equals: m.pillarSlug } }
    });
    await prisma.clusterMap.update({ where: { id: m.id }, data: { healthScore: count, lastChecked: new Date() } });
    if (count < 3) alerts.push({ pillar: m.pillarSlug, count, alert: 'Weniger als 3 Cluster-Seiten!' });
  }
  res.json({ success: true, alerts });
});

// ── board.js ──
const board = express.Router();

board.post('/review/:id', async (req, res) => {
  try {
    const result = await pipeline.runBoardReview(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── exportRoutes.js ──
const exportRoutes = express.Router();

exportRoutes.post('/wordpress/:id', async (req, res) => {
  try {
    const gen = await prisma.generation.findUnique({ where: { id: req.params.id } });
    if (!gen?.exportHtml) return res.status(400).json({ error: 'Export-HTML nicht vorhanden. Erst Pipeline abschließen.' });

    const wpUrl = process.env.WP_URL || 'https://schreinerhelden.de';
    const wpUser = process.env.WP_USER;
    const wpAppPassword = process.env.WP_APP_PASSWORD;

    if (!wpUser || !wpAppPassword) return res.status(400).json({ error: 'WordPress-Credentials nicht konfiguriert.' });

    const slug = gen.pageType === 'ORTS_LP' && gen.targetCity
      ? `schreiner-${gen.targetCity}`
      : gen.primaryKeyword.toLowerCase().replace(/\s+/g, '-').replace(/[äöüß]/g, m => ({ä:'ae',ö:'oe',ü:'ue',ß:'ss'}[m]));

    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64'),
      },
      body: JSON.stringify({
        title: gen.outputMeta?.title || gen.primaryKeyword,
        slug,
        content: gen.exportHtml,
        status: 'draft',
      })
    });

    if (!wpRes.ok) throw new Error(`WordPress API: ${wpRes.status} ${await wpRes.text()}`);
    const wpData = await wpRes.json();

    await prisma.generation.update({
      where: { id: gen.id },
      data: { wpPostId: wpData.id, wpUrl: wpData.link, status: 'PUBLISHED' }
    });

    res.json({ success: true, wpId: wpData.id, wpUrl: wpData.link, slug });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

exportRoutes.get('/html/:id', async (req, res) => {
  const gen = await prisma.generation.findUnique({ where: { id: req.params.id } });
  if (!gen?.exportHtml) return res.status(404).json({ error: 'Kein Export vorhanden.' });
  res.setHeader('Content-Type', 'text/html');
  res.send(gen.exportHtml);
});

// ── healthChecks.js ──
const healthChecks = express.Router();

// Board R4: CTA target check
healthChecks.post('/cta-target', async (req, res) => {
  try {
    const checkRes = await fetch('https://schreinerhelden.de/termin');
    const html = await checkRes.text();
    const hasLoremIpsum = html.includes('Lorem ipsum');
    const isOk = checkRes.ok && !hasLoremIpsum;

    await prisma.publicationCheck.create({
      data: { generationId: 'system', pageUrl: '/termin', checkType: 'cta_target_check',
              result: { statusCode: checkRes.status, hasLoremIpsum }, isHealthy: isOk }
    });

    res.json({ success: true, healthy: isOk, hasLoremIpsum, statusCode: checkRes.status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Board R4: Quartals-Rescan
healthChecks.post('/serp-rescan', async (req, res) => {
  const published = await prisma.generation.findMany({ where: { status: 'PUBLISHED' } });
  const results = [];
  for (const gen of published) {
    // Re-check SERP position
    try {
      const { fetchSERP } = require('../services/dataforseo');
      const serp = await fetchSERP(gen.primaryKeyword + ' ' + (gen.targetCity || ''));
      const ourPosition = serp.items?.find(i => i.url?.includes('schreinerhelden.de'))?.position;
      results.push({ id: gen.id, keyword: gen.primaryKeyword, city: gen.targetCity, position: ourPosition || 'not found' });
    } catch (e) { results.push({ id: gen.id, error: e.message }); }
    await new Promise(r => setTimeout(r, 500));
  }
  res.json({ success: true, results });
});

module.exports = { knowledge, cities, clusters, board, exportRoutes, healthChecks };
