const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../db');

router.get('/', async (req, res) => {
  try {
    const maps = await queryAll('SELECT * FROM cluster_map ORDER BY "healthScore" DESC');
    res.json({ success: true, data: maps });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const map = await queryOne(
      `INSERT INTO cluster_map (id, "pillarSlug", "pillarTitle", "clusterSlugs", "healthScore", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [d.pillarSlug, d.pillarTitle, d.clusterSlugs || [], d.healthScore || 0]
    );
    res.json({ success: true, data: map });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    const map = await queryOne(
      `UPDATE cluster_map SET "pillarTitle"=COALESCE($1,"pillarTitle"), "clusterSlugs"=COALESCE($2,"clusterSlugs"),
       "healthScore"=COALESCE($3,"healthScore"), "updatedAt"=NOW() WHERE id=$4 RETURNING *`,
      [d.pillarTitle, d.clusterSlugs, d.healthScore, req.params.id]
    );
    if (!map) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json({ success: true, data: map });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cluster health check
router.post('/check-health', async (req, res) => {
  try {
    const maps = await queryAll('SELECT * FROM cluster_map');
    const alerts = [];
    for (const m of maps) {
      const countRes = await queryOne(
        `SELECT COUNT(*)::int as count FROM generations WHERE status IN ('EXPORTED','PUBLISHED') AND "clusterMapping"->>'pillar' = $1`,
        [m.pillarSlug]
      );
      await query(
        `UPDATE cluster_map SET "healthScore"=$1, "lastChecked"=NOW() WHERE id=$2`,
        [countRes.count, m.id]
      );
      if (countRes.count < 3) alerts.push({ pillar: m.pillarSlug, count: countRes.count, alert: 'Weniger als 3 Cluster-Seiten!' });
    }
    res.json({ success: true, alerts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
