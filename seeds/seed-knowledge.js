// ============================================
// MEOS:HELDEN — Knowledge Base Seed (Raw SQL)
// Run: node seeds/seed-knowledge.js
// Requires: DATABASE_URL and OPENAI_API_KEY in .env
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
// Fallback: try root .env
if (!process.env.DATABASE_URL) require('dotenv').config();

const { pool, query, queryOne } = require('../backend/src/db');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embed(text) {
  const r = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text.slice(0, 8000) });
  return r.data[0].embedding;
}

async function seedChunk(c) {
  // Check if chunk with same title already exists
  const existing = await queryOne(
    `SELECT id FROM knowledge_chunks WHERE title = $1 AND category = $2`,
    [c.title, c.category]
  );
  if (existing) {
    console.log(`  ⏭️  Skip (exists): ${c.title}`);
    return existing;
  }

  const row = await queryOne(
    `INSERT INTO knowledge_chunks (id, category, subcategory, title, content, metadata, "isActive", "createdAt", "updatedAt")
     VALUES (uuid_generate_v4()::text, $1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
    [c.category, c.subcategory || null, c.title, c.content, c.metadata ? JSON.stringify(c.metadata) : null]
  );

  // Embed
  try {
    const emb = await embed(`${c.title}: ${c.content}`);
    await query(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, [`[${emb.join(',')}]`, row.id]);
  } catch (e) {
    console.log(`  ⚠️  Embed failed: ${e.message}`);
  }

  return row;
}

// Load chunk data — try JSON file first, fallback to inline minimal set
let chunks = [];
try {
  chunks = require('./seed-knowledge-data.json');
} catch (e) {
  console.log('  seed-knowledge-data.json not found — using inline minimal seed set\n');
  chunks = [
    { category: 'BRAND_SETTINGS', subcategory: 'schreinerhelden', title: 'Brand-Einstellungen Schreinerhelden',
      content: 'Schreinerhelden GmbH & Co. KG, Lindenstraße 9-15, 71540 Murrhardt. Tel: 07192-935 72 00. Proven Expert 4,95★ (200+ Bewertungen). Mario Esch: Schreinermeister seit 1985, Dozent Meisterschule Schwäbisch Hall. Du-Form, warm, schwäbisch-authentisch. Kein HOMAG-Branding, nur "CNC-Fertigung".' },
    { category: 'EXPERT_PRINCIPLE', subcategory: 'dieter-rams', title: 'Dieter Rams: Gutes Design ist ehrlich',
      content: 'Keine visuellen Tricks. Content muss ehrlich sein — echte Preise, echte Referenzen, echte Limitierungen. Wenn wir keine Referenz in einer Stadt haben, sagen wir das und nennen die nächste.' },
    { category: 'EXPERT_PRINCIPLE', subcategory: 'chris-voss', title: 'Chris Voss: Empathy-First Conversion',
      content: 'Starte mit dem Schmerz des Kunden. "Du hast die Dachschräge gemessen und merkst: Kein Schrank von der Stange passt." Erst validieren, dann lösen.' },
  ];
}

async function seed() {
  console.log(`🧠 Seeding ${chunks.length} knowledge chunks...\n`);

  let success = 0, fail = 0, skip = 0;
  for (const c of chunks) {
    try {
      const result = await seedChunk(c);
      if (result?.id) { success++; console.log(`  ✅ ${c.title}`); }
      else skip++;
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.log(`  ❌ ${c.title}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n📊 Ergebnis: ${success} neu, ${skip} übersprungen, ${fail} fehlgeschlagen`);
  console.log('🎉 Knowledge Base Seed fertig!\n');
}

seed().catch(console.error).finally(() => pool.end());
