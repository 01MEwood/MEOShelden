const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../db');

router.get('/', async (req, res) => {
  try {
    const profiles = await queryAll('SELECT * FROM city_profiles ORDER BY "priorityScore" DESC');
    res.json({ success: true, data: profiles });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:slug', async (req, res) => {
  try {
    const city = await queryOne('SELECT * FROM city_profiles WHERE slug = $1', [req.params.slug]);
    if (!city) return res.status(404).json({ error: 'Stadt nicht gefunden' });
    res.json({ success: true, data: city });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const city = await queryOne(
      `INSERT INTO city_profiles (id, name, slug, tier, einwohner, "kaufkraftIndex", "entfernungKm", "fahrtzeitMin", "priorityScore", "geoCode", "wikidataId", stadtteile, wohntypen, "painPoints", lokalkolorit, "uniqueValueAdd", "localBacklinks", "hasGbpStrategy", "indexStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, NOW(), NOW()) RETURNING *`,
      [d.name, d.slug, d.tier, d.einwohner, d.kaufkraftIndex, d.entfernungKm, d.fahrtzeitMin, d.priorityScore, d.geoCode, d.wikidataId, d.stadtteile||[], d.wohntypen||[], d.painPoints||[], d.lokalkolorit, d.uniqueValueAdd, d.localBacklinks||[], d.hasGbpStrategy||false, d.indexStatus||'noindex']
    );
    res.json({ success: true, data: city });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:slug', async (req, res) => {
  try {
    const d = req.body;
    const sets = [];
    const params = [];
    let idx = 1;
    const fields = ['name','tier','einwohner','lokalkolorit','indexStatus'];
    const quotedFields = ['kaufkraftIndex','entfernungKm','fahrtzeitMin','priorityScore','geoCode','wikidataId','uniqueValueAdd','hasGbpStrategy','firstExternalLink'];
    const arrayFields = ['stadtteile','wohntypen','painPoints','localBacklinks'];

    for (const f of fields) {
      if (d[f] !== undefined) { sets.push(`${f} = $${idx++}`); params.push(d[f]); }
    }
    for (const f of quotedFields) {
      if (d[f] !== undefined) { sets.push(`"${f}" = $${idx++}`); params.push(d[f]); }
    }
    for (const f of arrayFields) {
      if (d[f] !== undefined) { sets.push(`${f} = $${idx++}`); params.push(d[f]); }
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Nichts zu aktualisieren.' });
    sets.push(`"updatedAt" = NOW()`);
    params.push(req.params.slug);

    const city = await queryOne(
      `UPDATE city_profiles SET ${sets.join(', ')} WHERE slug = $${idx} RETURNING *`, params
    );
    if (!city) return res.status(404).json({ error: 'Stadt nicht gefunden' });
    res.json({ success: true, data: city });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
