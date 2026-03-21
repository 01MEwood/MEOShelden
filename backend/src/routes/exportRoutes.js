const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../db');
const { cloneTemplate, pushToWordPress } = require('../services/elementor-cloner');
const pipeline = require('../services/pipeline');

// Push single generation to WordPress as Elementor page
router.post('/wordpress/:id', async (req, res) => {
  try {
    const gen = await queryOne('SELECT * FROM generations WHERE id = $1', [req.params.id]);
    if (!gen) return res.status(404).json({ error: 'Generation nicht gefunden.' });
    if (!gen.outputContent) return res.status(400).json({ error: 'Kein Content vorhanden. Erst Pipeline abschließen.' });

    // Clone Elementor template with new content
    const elementorData = await cloneTemplate(gen);

    // Push to WordPress
    const result = await pushToWordPress(gen, elementorData);

    // Update generation record
    await query(
      `UPDATE generations SET "wpPostId"=$1, "wpUrl"=$2, status='PUBLISHED', "updatedAt"=NOW() WHERE id=$3`,
      [result.wpId, result.wpUrl, gen.id]
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch: Generate + Push for a single city
router.post('/wordpress-city', async (req, res) => {
  try {
    const { citySlug, primaryKeyword, targetProduct } = req.body;
    if (!citySlug) return res.status(400).json({ error: 'citySlug ist Pflicht.' });

    const city = await queryOne('SELECT * FROM city_profiles WHERE slug = $1', [citySlug]);
    if (!city) return res.status(404).json({ error: `Stadt ${citySlug} nicht gefunden.` });

    const keyword = primaryKeyword || `Schreiner ${city.name} Einbauschrank`;
    const product = targetProduct || 'Dachschrägenschrank';

    // Run full pipeline
    console.log(`\n🚀 Pipeline für ${city.name} gestartet...`);
    const gen = await pipeline.runFullPipeline({
      pageType: 'ORTS_LP',
      primaryKeyword: keyword,
      targetCity: citySlug,
      targetProduct: product,
      userId: req.user?.id,
    });

    if (!gen.outputContent) {
      return res.json({ success: false, city: city.name, error: 'Pipeline hat keinen Content generiert', status: gen.status });
    }

    // Clone template + push to WordPress
    const elementorData = await cloneTemplate(gen);
    const wpResult = await pushToWordPress(gen, elementorData);

    // Update generation
    await query(
      `UPDATE generations SET "wpPostId"=$1, "wpUrl"=$2, "updatedAt"=NOW() WHERE id=$3`,
      [wpResult.wpId, wpResult.wpUrl, gen.id]
    );

    console.log(`✅ ${city.name}: Draft erstellt → ${wpResult.wpUrl}`);
    res.json({ success: true, city: city.name, generation: gen.id, wordCount: gen.outputMeta?.wordCount, boardPass: gen.boardPass, ...wpResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch: Generate + Push for ALL cities (or selected tier)
router.post('/wordpress-batch', async (req, res) => {
  try {
    const { tier, cities: selectedCities, targetProduct } = req.body;
    const product = targetProduct || 'Dachschrägenschrank';

    // Get cities to process
    let cities;
    if (selectedCities && Array.isArray(selectedCities)) {
      cities = await queryAll(`SELECT * FROM city_profiles WHERE slug = ANY($1) ORDER BY "priorityScore" DESC`, [selectedCities]);
    } else if (tier) {
      cities = await queryAll(`SELECT * FROM city_profiles WHERE tier = $1 ORDER BY "priorityScore" DESC`, [tier]);
    } else {
      cities = await queryAll(`SELECT * FROM city_profiles ORDER BY "priorityScore" DESC`);
    }

    if (cities.length === 0) return res.status(400).json({ error: 'Keine Städte gefunden.' });

    // Return immediately, process in background
    res.json({
      success: true,
      message: `Batch gestartet: ${cities.length} Städte werden generiert und nach WordPress gepusht.`,
      cities: cities.map(c => c.name),
      total: cities.length,
    });

    // Background processing
    (async () => {
      const results = [];
      for (const city of cities) {
        try {
          const keyword = `Schreiner ${city.name} Einbauschrank`;
          console.log(`\n🏙️  [${results.length + 1}/${cities.length}] Pipeline: ${city.name}...`);

          const gen = await pipeline.runFullPipeline({
            pageType: 'ORTS_LP',
            primaryKeyword: keyword,
            targetCity: city.slug,
            targetProduct: product,
            userId: 'batch',
          });

          if (gen.outputContent) {
            const elementorData = await cloneTemplate(gen);
            const wpResult = await pushToWordPress(gen, elementorData);
            await query(`UPDATE generations SET "wpPostId"=$1, "wpUrl"=$2, "updatedAt"=NOW() WHERE id=$3`,
              [wpResult.wpId, wpResult.wpUrl, gen.id]);
            results.push({ city: city.name, success: true, wpId: wpResult.wpId, wordCount: gen.outputMeta?.wordCount, boardPass: gen.boardPass });
            console.log(`  ✅ ${city.name}: Draft → ${wpResult.wpUrl} (${gen.outputMeta?.wordCount}W)`);
          } else {
            results.push({ city: city.name, success: false, error: 'Kein Content', status: gen.status });
            console.log(`  ❌ ${city.name}: Kein Content (Status: ${gen.status})`);
          }

          // Pause between cities to not overload OpenAI
          await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
          results.push({ city: city.name, success: false, error: e.message });
          console.log(`  ❌ ${city.name}: ${e.message}`);
        }
      }

      const succeeded = results.filter(r => r.success).length;
      console.log(`\n📊 Batch fertig: ${succeeded}/${cities.length} Städte erfolgreich nach WordPress gepusht.\n`);
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get batch status (check which cities have WP drafts)
router.get('/wordpress-status', async (req, res) => {
  try {
    const cities = await queryAll(`SELECT * FROM city_profiles ORDER BY "priorityScore" DESC`);
    const generations = await queryAll(
      `SELECT "targetCity", status, "wpPostId", "wpUrl", "outputMeta", "boardPass", "createdAt"
       FROM generations WHERE "pageType"='ORTS_LP' AND "targetCity" IS NOT NULL
       ORDER BY "createdAt" DESC`
    );

    // Group by city, take latest
    const byCityMap = {};
    for (const g of generations) {
      if (!byCityMap[g.targetCity]) byCityMap[g.targetCity] = g;
    }

    const status = cities.map(c => ({
      city: c.name,
      slug: c.slug,
      tier: c.tier,
      hasGeneration: !!byCityMap[c.slug],
      wpDraft: byCityMap[c.slug]?.wpPostId ? true : false,
      wpId: byCityMap[c.slug]?.wpPostId || null,
      wpUrl: byCityMap[c.slug]?.wpUrl || null,
      wordCount: byCityMap[c.slug]?.outputMeta?.wordCount || null,
      boardPass: byCityMap[c.slug]?.boardPass || null,
      status: byCityMap[c.slug]?.status || 'NICHT GENERIERT',
    }));

    const total = cities.length;
    const generated = status.filter(s => s.hasGeneration).length;
    const pushed = status.filter(s => s.wpDraft).length;

    res.json({ success: true, total, generated, pushed, cities: status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get export HTML (legacy)
router.get('/html/:id', async (req, res) => {
  try {
    const gen = await queryOne('SELECT "exportHtml" FROM generations WHERE id = $1', [req.params.id]);
    if (!gen?.exportHtml) return res.status(404).json({ error: 'Kein Export vorhanden.' });
    res.setHeader('Content-Type', 'text/html');
    res.send(gen.exportHtml);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════
// SCHEMA.ORG PREVIEW & BATCH EXPORT
// ════════════════════════════════════

const { generateSchemaStack } = require('../services/schema-generator');

// Preview schema stack for a single city (no pipeline needed)
router.get('/schema-preview/:citySlug', async (req, res) => {
  try {
    const city = await queryOne('SELECT * FROM city_profiles WHERE slug = $1', [req.params.citySlug]);
    if (!city) return res.status(404).json({ error: `Stadt ${req.params.citySlug} nicht gefunden.` });

    const product = req.query.product || 'Dachschrägenschrank';
    const result = generateSchemaStack({ city, pageType: 'ORTS_LP', targetProduct: product });

    if (req.query.format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(`<!DOCTYPE html><html><head><title>Schema: ${city.name}</title>${result.htmlScript}</head><body><h1>Schema.org für ${city.name}</h1><p>${result.summary.schemaCount} Blöcke: ${result.summary.types.join(', ')}</p><pre>${JSON.stringify(result.blocks, null, 2)}</pre></body></html>`);
    }

    res.json({ success: true, city: city.name, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Batch: Generate schema for ALL cities
router.get('/schema-batch', async (req, res) => {
  try {
    const tier = req.query.tier ? parseInt(req.query.tier) : null;
    const cities = tier
      ? await queryAll('SELECT * FROM city_profiles WHERE tier = $1 ORDER BY "priorityScore" DESC', [tier])
      : await queryAll('SELECT * FROM city_profiles ORDER BY "priorityScore" DESC');

    const product = req.query.product || 'Dachschrägenschrank';
    const results = cities.map(city => {
      try {
        const schema = generateSchemaStack({ city, pageType: 'ORTS_LP', targetProduct: product });
        return { city: city.name, slug: city.slug, tier: city.tier, success: true, ...schema.summary };
      } catch (e) {
        return { city: city.name, slug: city.slug, success: false, error: e.message };
      }
    });

    const succeeded = results.filter(r => r.success).length;
    res.json({
      success: true,
      total: cities.length,
      generated: succeeded,
      totalSchemaBlocks: results.reduce((sum, r) => sum + (r.schemaCount || 0), 0),
      cities: results,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Validate schema of an existing generation
router.get('/schema-validate/:id', async (req, res) => {
  try {
    const gen = await queryOne('SELECT "outputSchema", "targetCity" FROM generations WHERE id = $1', [req.params.id]);
    if (!gen) return res.status(404).json({ error: 'Generation nicht gefunden.' });

    const schema = typeof gen.outputSchema === 'string' ? JSON.parse(gen.outputSchema) : gen.outputSchema;
    const checks = [];

    if (!schema) {
      checks.push({ check: 'Schema vorhanden', pass: false, detail: 'Kein Schema generiert' });
      return res.json({ success: true, valid: false, checks });
    }

    // Check for new format (has htmlScript)
    const isNewFormat = !!schema.htmlScript;
    checks.push({ check: 'Format', pass: isNewFormat, detail: isNewFormat ? 'Neuer deterministischer Generator' : 'Legacy GPT-4o Format' });

    const blocks = schema.blocks || (Array.isArray(schema) ? schema : [schema]);
    checks.push({ check: 'Block-Anzahl', pass: blocks.length >= 5, detail: `${blocks.length} Blöcke` });

    const types = blocks.map(b => Array.isArray(b['@type']) ? b['@type'][0] : b['@type']);
    const requiredTypes = ['Organization', 'Person', 'FAQPage', 'Product'];
    if (gen.targetCity) requiredTypes.push('LocalBusiness');

    for (const rt of requiredTypes) {
      const found = types.some(t => t && t.includes(rt));
      checks.push({ check: `${rt} vorhanden`, pass: found, detail: found ? '✅' : '❌ FEHLT' });
    }

    const allPass = checks.every(c => c.pass);
    res.json({ success: true, valid: allPass, checks, blockCount: blocks.length, types });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
