const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../db');
const pipeline = require('../services/pipeline');

// List chunks with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, subcategory, search, page = 1, limit = 50 } = req.query;
    const conditions = ['"isActive" = true'];
    const params = [];
    let idx = 1;

    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    if (subcategory) { conditions.push(`subcategory = $${idx++}`); params.push(subcategory); }
    if (search) {
      conditions.push(`(title ILIKE $${idx} OR content ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [chunks, countRes] = await Promise.all([
      queryAll(
        `SELECT id, category, subcategory, title, content, metadata, "isActive",
                embedding IS NOT NULL as "hasEmbedding", "createdAt", "updatedAt"
         FROM knowledge_chunks WHERE ${where}
         ORDER BY "updatedAt" DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, parseInt(limit), offset]
      ),
      queryOne(`SELECT COUNT(*)::int as total FROM knowledge_chunks WHERE ${where}`, params),
    ]);

    res.json({ success: true, chunks, total: countRes.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create chunk + embed
router.post('/', async (req, res) => {
  try {
    const { category, subcategory, title, content, metadata } = req.body;
    if (!category || !title || !content) return res.status(400).json({ error: 'category, title, content erforderlich' });

    const row = await queryOne(
      `INSERT INTO knowledge_chunks (id, category, subcategory, title, content, metadata, "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING *`,
      [category, subcategory || null, title, content, metadata ? JSON.stringify(metadata) : null]
    );

    // Generate embedding
    try {
      const emb = await pipeline.createEmbedding(`${title}: ${content}`);
      await query(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, [`[${emb.join(',')}]`, row.id]);
    } catch (e) { console.error('Embedding failed:', e.message); }

    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch create
router.post('/batch', async (req, res) => {
  try {
    const { chunks } = req.body;
    if (!Array.isArray(chunks)) return res.status(400).json({ error: 'chunks Array erforderlich' });
    const results = [];
    for (const c of chunks) {
      try {
        const row = await queryOne(
          `INSERT INTO knowledge_chunks (id, category, subcategory, title, content, metadata, "isActive", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
          [c.category, c.subcategory || null, c.title, c.content, c.metadata ? JSON.stringify(c.metadata) : null]
        );
        try {
          const emb = await pipeline.createEmbedding(`${c.title}: ${c.content}`);
          await query(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, [`[${emb.join(',')}]`, row.id]);
        } catch (e) { console.error(`Embed failed for ${c.title}:`, e.message); }
        results.push({ success: true, id: row.id, title: c.title });
        await new Promise(r => setTimeout(r, 100));
      } catch (e) { results.push({ success: false, title: c.title, error: e.message }); }
    }
    res.json({ success: true, results, succeeded: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update chunk + re-embed
router.put('/:id', async (req, res) => {
  try {
    const { title, content, subcategory, metadata } = req.body;
    const row = await queryOne(
      `UPDATE knowledge_chunks SET title=$1, content=$2, subcategory=$3, metadata=$4, "updatedAt"=NOW()
       WHERE id=$5 RETURNING *`,
      [title, content, subcategory || null, metadata ? JSON.stringify(metadata) : null, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Chunk nicht gefunden.' });

    try {
      const emb = await pipeline.createEmbedding(`${title}: ${content}`);
      await query(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, [`[${emb.join(',')}]`, req.params.id]);
    } catch (e) { console.error('Re-embed failed:', e.message); }

    res.json({ success: true, data: row });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Soft delete
router.delete('/:id', async (req, res) => {
  try {
    await query(`UPDATE knowledge_chunks SET "isActive"=false, "updatedAt"=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Embed all chunks that don't have embeddings yet
router.post('/embed-all', async (req, res) => {
  try {
    const unembedded = await queryAll(
      `SELECT id, title, content FROM knowledge_chunks WHERE embedding IS NULL AND "isActive" = true`
    );
    if (unembedded.length === 0) {
      return res.json({ success: true, message: 'Alle Chunks haben bereits Embeddings.', total: 0 });
    }

    // Return immediately, process in background
    res.json({ success: true, message: `Starte Embedding für ${unembedded.length} Chunks...`, total: unembedded.length });

    (async () => {
      let success = 0, failed = 0;
      for (const chunk of unembedded) {
        try {
          const emb = await pipeline.createEmbedding(`${chunk.title}: ${chunk.content}`);
          await query(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, [`[${emb.join(',')}]`, chunk.id]);
          success++;
          console.log(`  ✅ Embedded: ${chunk.title} (${success}/${unembedded.length})`);
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          failed++;
          console.log(`  ❌ Failed: ${chunk.title}: ${e.message}`);
        }
      }
      console.log(`\n🧠 Embedding complete: ${success} success, ${failed} failed\n`);
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Embedding status
router.get('/embed-status', async (req, res) => {
  try {
    const total = await queryOne(`SELECT COUNT(*)::int as count FROM knowledge_chunks WHERE "isActive" = true`);
    const embedded = await queryOne(`SELECT COUNT(*)::int as count FROM knowledge_chunks WHERE "isActive" = true AND embedding IS NOT NULL`);
    res.json({ success: true, total: total.count, embedded: embedded.count, missing: total.count - embedded.count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
