// ============================================
// MEOS:HELDEN — Knowledge Base Seed
// Run: node seeds/seed-knowledge.js
// Requires: DATABASE_URL and OPENAI_API_KEY in .env
// ============================================

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embed(text) {
  const r = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text.slice(0, 8000) });
  return r.data[0].embedding;
}

async function seedChunk(c) {
  const chunk = await prisma.knowledgeChunk.create({
    data: { category: c.category, subcategory: c.subcategory, title: c.title, content: c.content, metadata: c.metadata }
  });
  const emb = await embed(`${c.title}: ${c.content}`);
  await prisma.$executeRawUnsafe(`UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`, `[${emb.join(',')}]`, chunk.id);
  return chunk;
}

// All chunks defined in /home/claude/heldenformel-rag/seeds/seed-knowledge.js
// Reusing the same data — see that file for the full 35+ chunks
// For brevity, loading from the existing seed data

const chunks = require('../../heldenformel-rag/seeds/seed-knowledge-data.json');

async function seed() {
  console.log('🧠 Seeding knowledge base...');
  console.log('   This will take ~60 seconds (embedding each chunk via OpenAI)\n');

  let success = 0, fail = 0;
  for (const c of chunks) {
    try {
      await seedChunk(c);
      console.log(`  ✅ ${c.title}`);
      success++;
      await new Promise(r => setTimeout(r, 120)); // Rate limit
    } catch (e) {
      console.log(`  ❌ ${c.title}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n📊 Ergebnis: ${success} erfolgreich, ${fail} fehlgeschlagen`);
  console.log('🎉 Knowledge Base ready!\n');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
