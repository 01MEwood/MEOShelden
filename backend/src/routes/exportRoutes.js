const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../db');

// Push to WordPress
router.post('/wordpress/:id', async (req, res) => {
  try {
    const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [req.params.id]);
    if (!gen?.exportHtml) return res.status(400).json({ error: 'Export-HTML nicht vorhanden. Erst Pipeline abschließen.' });

    const wpUrl = process.env.WP_URL || 'https://schreinerhelden.de';
    const wpUser = process.env.WP_USER;
    const wpAppPassword = process.env.WP_APP_PASSWORD;
    if (!wpUser || !wpAppPassword) return res.status(400).json({ error: 'WordPress-Credentials nicht konfiguriert.' });

    const slug = gen.pageType === 'ORTS_LP' && gen.targetCity
      ? `schreiner-${gen.targetCity}`
      : gen.primaryKeyword.toLowerCase().replace(/\s+/g, '-').replace(/[äöüß]/g, m => ({ä:'ae',ö:'oe',ü:'ue',ß:'ss'})[m]);

    const wpRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64'),
      },
      body: JSON.stringify({
        title: gen.outputMeta?.title || gen.primaryKeyword,
        slug, content: gen.exportHtml, status: 'draft',
      })
    });
    if (!wpRes.ok) throw new Error(`WordPress API: ${wpRes.status} ${await wpRes.text()}`);
    const wpData = await wpRes.json();

    await query(
      `UPDATE generations SET "wpPostId"=$1, "wpUrl"=$2, status='PUBLISHED', "updatedAt"=NOW() WHERE id=$3`,
      [wpData.id, wpData.link, gen.id]
    );
    res.json({ success: true, wpId: wpData.id, wpUrl: wpData.link, slug });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get export HTML
router.get('/html/:id', async (req, res) => {
  try {
    const gen = await queryOne('SELECT "exportHtml" FROM generations WHERE id = $1', [req.params.id]);
    if (!gen?.exportHtml) return res.status(404).json({ error: 'Kein Export vorhanden.' });
    res.setHeader('Content-Type', 'text/html');
    res.send(gen.exportHtml);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
