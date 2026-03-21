// ============================================
// MEOS:HELDEN — Social Content Multiplier
// Adapted from SEO Command Center prompts.js v5.5.4
// Generates GBP, Instagram/Facebook, Pinterest, Blog from LP content
// ============================================

const { getOpenAI } = require('./pipeline');

const SOCIAL_SYSTEM = `Du bist Social-Content-Experte für Schreinerhelden — authentische Handwerker-Marke aus Murrhardt bei Stuttgart.
Ton: Echt, handwerklich, nahbar, premium. Team-Sprache. Kein Corporate-Blabla.
WICHTIG: Lokalkolorit! Teilorte, schwäbische Identität, Werkstatt-Atmosphäre.
Kontakt: 07192-935 72 00 | https://schreinerhelden.de/termin
Mario Esch, Schreinermeister seit 1985, Dozent Meisterschule Schwäbisch Hall.
Proven Expert: 4,95★ (200+ Bewertungen)

REGELN:
- Du-Ansprache, NIEMALS Sie
- Storytelling: Werkstatt-Szenen, Aufmaß-Geschichten, Montage-Momente
- Schwäbische Werte: Qualität, Verlässlichkeit, Transparenz
- Immer CTA am Ende: Termin buchen
- Testimonials OHNE Jahreszahlen
- Keine internen Begriffe (kein "Lokalkolorit", kein "Pain Point")`;

const CHANNELS = {
  gbp: {
    name: 'Google Business Profil',
    icon: '📍',
    prompt: (keyword, city, lpSummary) =>
`Schreibe einen Google Business Profile Beitrag.

KEYWORD: "${keyword}"
STADT: ${city}
LANDINGPAGE-ZUSAMMENFASSUNG: ${lpSummary}

REGELN:
- Max 1.500 Zeichen
- Nenne 2-3 Teilorte von ${city}
- Starte mit einer konkreten Storytelling-Szene ("Letzte Woche Aufmaß in...")
- Schwäbisch-authentisch
- Ende mit CTA: "Jetzt kostenlosen Online-Planungstermin buchen: schreinerhelden.de/termin"
- Max 1 Emoji
- Erwähne Entfernung Murrhardt → ${city}

FORMAT: Nur der Post-Text, keine Überschrift, kein JSON.`
  },

  instagram: {
    name: 'Instagram / Facebook',
    icon: '📸',
    prompt: (keyword, city, lpSummary) =>
`Schreibe einen Instagram/Facebook Post.

KEYWORD: "${keyword}"
STADT: ${city}
LANDINGPAGE-ZUSAMMENFASSUNG: ${lpSummary}

REGELN:
- Max 2.200 Zeichen Caption
- Hook-Szene als erste Zeile ("Aufmaß in ${city}. 3. OG. Dachschräge. Kein Schrank passt.")
- 2-3 Teilorte von ${city} natürlich einbauen
- 15-20 Hashtags (inkl. #Schreinerhelden #${city.replace(/\s+/g, '')} #RemsMurrKreis #Murrhardt #SchreinerStuttgart #Einbauschrank #Dachschräge)
- Konkretes Bildmotiv vorschlagen
- Beste Posting-Zeit vorschlagen

FORMAT (JSON):
{
  "caption": "...",
  "hashtags": ["#...", "#..."],
  "imageIdea": "Kurze Bildbeschreibung für Rike/Melanie",
  "bestTime": "z.B. Dienstag 18:00"
}`
  },

  pinterest: {
    name: 'Pinterest',
    icon: '📌',
    prompt: (keyword, city, lpSummary) =>
`Schreibe einen Pinterest Pin.

KEYWORD: "${keyword}"
STADT: ${city}
LANDINGPAGE-ZUSAMMENFASSUNG: ${lpSummary}

REGELN:
- Titel: Max 100 Zeichen, keyword-reich
- Beschreibung: Max 500 Zeichen, "Schreinerei bei Stuttgart"
- Board-Vorschlag (z.B. "Dachschrägenschrank Ideen" oder "Einbauschrank Stuttgart")
- Bild-Konzept für Rike (z.B. "Vorher/Nachher Dachschräge mit Schrank")
- Link zur Landingpage

FORMAT (JSON):
{
  "title": "...",
  "description": "...",
  "board": "...",
  "imageIdea": "...",
  "link": "https://schreinerhelden.de/schreiner-${city.toLowerCase().replace(/\s+/g,'-')}",
  "altText": "Kurzer Alt-Text für SEO"
}`
  },

  blog: {
    name: 'Blog-Artikel',
    icon: '📝',
    prompt: (keyword, city, lpSummary) =>
`Schreibe einen Blog-Artikel Entwurf.

KEYWORD: "${keyword}"
STADT: ${city}
LANDINGPAGE-ZUSAMMENFASSUNG: ${lpSummary}

REGELN:
- KEIN Duplikat der Landingpage! Andere Perspektive, anderer Aufhänger
- Story-Start aus ${city}: "Aufmaß in [konkreter Teilort]..."
- 800-1.200 Wörter
- Mario-Stimme (als Schreinermeister der erzählt)
- 3+ Teilorte von ${city} natürlich einbauen
- Link zur Landingpage als internen Verweis
- CTA am Ende: Termin buchen
- Meta-Title + Meta-Description oben im Text

FORMAT: Markdown mit Meta-Kommentar am Anfang.`
  },
};

// Generate content for a single channel
async function generateSocialContent(channel, keyword, city, lpSummary) {
  const ch = CHANNELS[channel];
  if (!ch) throw new Error(`Unbekannter Kanal: ${channel}. Verfügbar: ${Object.keys(CHANNELS).join(', ')}`);

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SOCIAL_SYSTEM },
      { role: 'user', content: ch.prompt(keyword, city, lpSummary) },
    ],
    max_tokens: channel === 'blog' ? 4000 : 2000,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content || '';

  // Try to parse JSON for instagram/pinterest
  if (channel === 'instagram' || channel === 'pinterest') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return { raw: text, parsed: JSON.parse(jsonMatch[0]) };
    } catch (e) { /* Return raw text if JSON parsing fails */ }
  }

  return { raw: text, parsed: null };
}

// Generate all channels at once (bulk)
async function generateAllSocial(keyword, city, lpSummary, channels = ['gbp', 'instagram', 'pinterest', 'blog']) {
  const results = {};
  for (const ch of channels) {
    try {
      results[ch] = await generateSocialContent(ch, keyword, city, lpSummary);
      // Small pause between API calls
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      results[ch] = { raw: `Fehler: ${e.message}`, parsed: null, error: true };
    }
  }
  return results;
}

// Create LP summary from generation data (for social prompts)
function createLpSummary(generation) {
  const content = generation.outputContent || '';
  const meta = generation.outputMeta || {};
  // Take first 500 words as summary
  const words = content.split(/\s+/).slice(0, 500).join(' ');
  return `Title: ${meta.title || ''}\nKeyword: ${generation.primaryKeyword || ''}\nStadt: ${generation.targetCity || ''}\nInhalt (Auszug): ${words}`;
}

module.exports = {
  generateSocialContent,
  generateAllSocial,
  createLpSummary,
  CHANNELS,
};
