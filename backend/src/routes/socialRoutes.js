const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../db');
const { generateSocialContent, generateAllSocial, createLpSummary, CHANNELS } = require('../services/social');

// List available channels
router.get('/channels', (req, res) => {
  const channels = Object.entries(CHANNELS).map(([id, ch]) => ({
    id, name: ch.name, icon: ch.icon,
  }));
  res.json({ success: true, channels });
});

// Generate social content for single channel from a generation
router.post('/generate/:id', async (req, res) => {
  try {
    const { channel } = req.body;
    if (!channel) return res.status(400).json({ error: 'Channel ist Pflicht (gbp, instagram, pinterest, blog).' });

    const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [req.params.id]);
    if (!gen) return res.status(404).json({ error: 'Generation nicht gefunden.' });
    if (!gen.outputContent) return res.status(400).json({ error: 'Kein Content vorhanden.' });

    const lpSummary = createLpSummary(gen);
    const city = gen.targetCity || '';
    const keyword = gen.primaryKeyword || '';

    console.log(`📢 Social [${channel}] für "${keyword}" / ${city}...`);
    const result = await generateSocialContent(channel, keyword, city, lpSummary);

    // Save to DB
    await query(
      `INSERT INTO social_content (id, "generationId", channel, content, "parsedData", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
       ON CONFLICT ("generationId", channel) DO UPDATE SET content=$3, "parsedData"=$4, "createdAt"=NOW()`,
      [gen.id, channel, result.raw, result.parsed ? JSON.stringify(result.parsed) : null]
    );

    res.json({ success: true, channel, content: result.raw, parsed: result.parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate ALL channels for a generation (bulk)
router.post('/bulk/:id', async (req, res) => {
  try {
    const { channels } = req.body;
    const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [req.params.id]);
    if (!gen) return res.status(404).json({ error: 'Generation nicht gefunden.' });
    if (!gen.outputContent) return res.status(400).json({ error: 'Kein Content vorhanden.' });

    const lpSummary = createLpSummary(gen);
    const city = gen.targetCity || '';
    const keyword = gen.primaryKeyword || '';
    const selectedChannels = channels || ['gbp', 'instagram', 'pinterest', 'blog'];

    console.log(`📢 Bulk Social für "${keyword}" / ${city}: ${selectedChannels.join(', ')}`);
    const results = await generateAllSocial(keyword, city, lpSummary, selectedChannels);

    // Save all to DB
    for (const [ch, result] of Object.entries(results)) {
      if (!result.error) {
        await query(
          `INSERT INTO social_content (id, "generationId", channel, content, "parsedData", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
           ON CONFLICT ("generationId", channel) DO UPDATE SET content=$3, "parsedData"=$4, "createdAt"=NOW()`,
          [gen.id, ch, result.raw, result.parsed ? JSON.stringify(result.parsed) : null]
        );
      }
    }

    res.json({ success: true, keyword, city, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get saved social content for a generation
router.get('/content/:generationId', async (req, res) => {
  try {
    const rows = await require('../db').queryAll(
      `SELECT * FROM social_content WHERE "generationId" = $1 ORDER BY channel`, [req.params.generationId]
    );
    const byChannel = {};
    for (const r of rows) {
      byChannel[r.channel] = { content: r.content, parsed: r.parsedData, createdAt: r.createdAt };
    }
    res.json({ success: true, social: byChannel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
