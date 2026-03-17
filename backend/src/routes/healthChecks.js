const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../db');

// CTA target check
router.post('/cta-target', async (req, res) => {
  try {
    const checkRes = await fetch('https://schreinerhelden.de/termin');
    const html = await checkRes.text();
    const hasLoremIpsum = html.includes('Lorem ipsum');
    const isOk = checkRes.ok && !hasLoremIpsum;

    await query(
      `INSERT INTO publication_checks (id, "generationId", "pageUrl", "checkType", result, "isHealthy", "checkedAt")
       VALUES (gen_random_uuid(), 'system', '/termin', 'cta_target_check', $1, $2, NOW())`,
      [JSON.stringify({ statusCode: checkRes.status, hasLoremIpsum }), isOk]
    );
    res.json({ success: true, healthy: isOk, hasLoremIpsum, statusCode: checkRes.status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// SERP Rescan
router.post('/serp-rescan', async (req, res) => {
  try {
    const published = await queryAll(`SELECT * FROM generations WHERE status = 'PUBLISHED'`);
    const results = [];
    const { fetchSERP } = require('../services/dataforseo');
    for (const gen of published) {
      try {
        const serp = await fetchSERP(gen.primaryKeyword + ' ' + (gen.targetCity || ''));
        const ourPosition = serp.items?.find(i => i.url?.includes('schreinerhelden.de'))?.position;
        results.push({ id: gen.id, keyword: gen.primaryKeyword, city: gen.targetCity, position: ourPosition || 'not found' });
      } catch (e) { results.push({ id: gen.id, error: e.message }); }
      await new Promise(r => setTimeout(r, 500));
    }
    res.json({ success: true, results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
