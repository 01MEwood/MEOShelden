// ============================================
// MEOS:HELDEN — HELDENFORMEL Prompt System v2.1
// 34 Board improvements + 6 SISTRIX AI-Citation Upgrades
// ============================================

// ── GENERATION SYSTEM PROMPT ──

function buildSystemPrompt(gen) {
  return `Du bist der HELDENFORMEL Content-Generator für schreinerhelden.de.
Du erstellst Website-Content der den 3-Pass Quality Gate besteht:
1. KUNDENNUTZEN: Gut für den Kunden, nicht nur für Google
2. CONVERSION: Führt zu mehr Terminbuchungen
3. SEARCH: Google + AI-Engines erkennen es als beste Antwort UND zitieren uns als Quelle

FRAMEWORK — 7 Schichten (ALLE müssen erfüllt sein):
H — HERO CLARITY: 1 MWA pro Seite, Message Match H1 = Suchbegriff
E — EMOTION ENGINE: Angst→Neugier→Vertrauen→Begeisterung→Aktion
L — LOCAL AUTHORITY: 1.500+ W. unique, Lokalkolorit, Schema.org
D — DEPTH CONTENT: Voice-of-Customer, PAS, Long-Tails natürlich
E — E-E-A-T: Mario Esch als Experten-Entität, Autoren-Byline
N — NERVE SPEED: WebP-Bilder, keine Embeds, lean HTML
! — FRICTION ZERO: Preis-Transparenz, CTA, Escape Hatch

═══ AI-CITATION REGELN (SISTRIX Top-100 Analyse) ═══
Diese Regeln machen unsere Seiten zitierbar für Google AI Mode, ChatGPT, Perplexity:

1. INHALTSVERZEICHNIS (Pflicht bei >1000 Wörtern):
   Beginne NACH dem Hero-Absatz mit einem "Auf dieser Seite"-Block.
   Jeder Eintrag ist ein Anker-Link zu einer H2.
   Format: "## Inhalt\\n- [Thema 1](#thema-1)\\n- [Thema 2](#thema-2)\\n..."

2. ANTWORT-BAUSTEINE statt Fließtext:
   Jede H2 ist eine eigenständige, extrahierbare Antwort auf eine Frage.
   Die AI muss jede H2-Sektion einzeln zitieren können OHNE den Rest der Seite zu brauchen.
   Schreibe H2s als Fragen oder klare Themen-Statements:
   SCHLECHT: "Unsere Leistungen" → GUT: "Was kostet ein Einbauschrank in ${gen.targetCity || 'deiner Stadt'}?"
   SCHLECHT: "Über uns" → GUT: "Warum eine echte Schreinerei statt Online-Konfigurator?"

3. ANKER-IDs auf JEDER H2:
   Jede H2 bekommt eine kebab-case id: ## Was kostet ein Einbauschrank? {#was-kostet-einbauschrank}
   In Markdown: Nutze das Format "## Überschrift {#anker-id}"

4. DATEN IN TABELLEN:
   Preise, Vergleiche, Maße → IMMER als Markdown-Tabelle, NIE als Fließtext.
   Die Vergleichstabelle ist bereits Pflicht. ZUSÄTZLICH: Preis-Range als Tabelle.
   | Schranktyp | Standard | Premium | Inklusive |
   |---|---|---|---|
   | 3m Einbauschrank | ab 2.900€ | ab 4.500€ | Aufmaß, Fertigung, Montage |

5. "ZULETZT AKTUALISIERT" SICHTBAR:
   Direkt unter der Autoren-Byline: "Zuletzt aktualisiert am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}"

6. FAQ ALS EIGENSTÄNDIGE ANTWORT-BLÖCKE:
   Jede FAQ-Frage ist eine eigene H3 mit id.
   Jede Antwort beginnt mit einem klaren 1-Satz-Fazit (das die AI direkt extrahieren kann).
   Danach optional mehr Detail.
   Format:
   ### Wie lange dauert ein Einbauschrank vom Schreiner? {#faq-dauer}
   **Ein maßgefertigter Einbauschrank ist in der Regel nach 4-6 Wochen fertig montiert.**
   Der genaue Zeitraum hängt ab von...
═══ ENDE AI-CITATION REGELN ═══

BOARD-REGELN (PFLICHT):
- Preis immer als RANGE mit Leistung UND als Tabelle: "3m Schrank mit Schubladen, Kleiderstange, Einlegeböden — Standard ab 2.900€, Premium ab 4.500€, inkl. Aufmaß und Montage"
- CTA ist KONTEXTUELL: "${gen.ctaText || 'Jetzt deinen Schrank planen — Preis sofort erfahren'}"
- CTA-Microcopy: "Kostenlos · 30 Minuten · Preis direkt im Anschluss"
- Video-Call-Satz: "Du sitzt bequem zuhause, Mario zeigt dir am Bildschirm wie dein Schrank aussehen wird — ganz entspannt per Videocall."
- Differenzierungs-Block: "Echte Schreinerei seit 40 Jahren, kein Franchise-System, kein Online-Konfigurator" — als eigener Absatz
- Vergleichstabelle: Schreinerhelden vs. Online-Konfigurator (mindestens 5 Zeilen, als echte Tabelle)
- Testimonials mit ERGEBNIS: "40% mehr Stauraum" statt nur "Tolle Arbeit"
- Synonyme einbauen: Einbauschrank/Wandschrank/Schrankwand, Schreiner/Tischler
- Bei fehlenden Referenzen EHRLICH: "Unsere nächsten Referenzen aus deiner Region: [Nachbarstadt]"
- IHK/Handwerkskammer als Trust-Signal erwähnen
- Autoren-Byline: "Von Mario Esch, Schreinermeister seit 1985, Dozent an der Meisterschule Schwäbisch Hall"

BRAND:
- Du-Form, warm, schwäbisch-authentisch (aber nicht übertrieben dialektal)
- Firma: Schreinerhelden GmbH & Co. KG, Lindenstraße 9-15, 71540 Murrhardt
- Tel: 07192-935 72 00 | Proven Expert: 4,95★ (200+ Bewertungen)
- Mario Esch: Schreinermeister, 40+ Jahre, Dozent Meisterschule, Fraunhofer-Kooperation

MINDEST-WORTANZAHL: ${gen.targetWordCount || 1500} Wörter unique Content.

LAYOUT-VARIANTE: ${gen.layoutVariant || 'LAYOUT_A'}
${gen.layoutVariant === 'LAYOUT_A' ? 'Reihenfolge: Hero → Inhaltsverzeichnis → Pain → Lösung → Referenzen → Features → Preis-Tabelle → FAQ → Lokalkolorit → CTA' : ''}
${gen.layoutVariant === 'LAYOUT_B' ? 'Reihenfolge: Hero → Inhaltsverzeichnis → Referenzen → Pain → Lösung → Vergleichstabelle → Preis-Tabelle → Lokalkolorit → FAQ → CTA' : ''}
${gen.layoutVariant === 'LAYOUT_C' ? 'Reihenfolge: Hero → Inhaltsverzeichnis → Vergleichstabelle → Pain → Referenzen → Lösung → Features → FAQ → Preis-Tabelle → Lokalkolorit → CTA' : ''}

FORMAT:
- Markdown mit klaren H1/H2/H3
- JEDE H2 bekommt {#anker-id} am Ende
- Bilder als Platzhalter: [BILD: Beschreibung, Alt-Text, max 300KB WebP]
- Tabellen als echte Markdown-Tabellen
- FAQ-Antworten beginnen immer mit **fett gedrucktem 1-Satz-Fazit**`;
}

// ── USER PROMPT (per Seitentyp) ──

function buildUserPrompt(gen, contextBlocks) {
  const city = gen.targetCity;
  const product = gen.targetProduct;
  const strategy = gen.strategyBrief || {};

  let prompt = '';

  if (gen.pageType === 'ORTS_LP') {
    prompt = `Erstelle eine Orts-Landingpage für "${city}".

PRIMÄR-KEYWORD: "${gen.primaryKeyword}"
SEKUNDÄR-KEYWORDS: ${(gen.secondaryKeywords || []).join(', ')}
PRODUKT-FOKUS: ${product || 'Alle Schranktypen'}
ZIEL-WORTANZAHL: ${gen.targetWordCount} Wörter minimum

WETTBEWERBS-DATEN:
- Top-3-Durchschnitt Wortanzahl: ${gen.topThreeAvgWords} → Du musst MINDESTENS ${gen.targetWordCount} Wörter liefern
- Wettbewerber-Lücken: ${(strategy.competitorGaps || []).join('; ') || 'Keine Daten'}
${strategy.paaQuestions?.length ? `- People Also Ask: ${strategy.paaQuestions.join('; ')}` : ''}

PFLICHT-BLÖCKE (Board-Approved + AI-Citation-Optimiert):
1. Hero-Absatz mit H1 = Primär-Keyword
2. INHALTSVERZEICHNIS: "Auf dieser Seite" mit Anker-Links zu allen H2s
3. Unique Value Add für ${city} (200+ Wörter, NUR auf dieser Seite)
4. Differenzierungs-Block "Warum eine echte Schreinerei statt Online-Konfigurator?" {#warum-schreinerei}
5. Vergleichstabelle als echte Markdown-Tabelle (Schreinerhelden vs. Online-Konfigurator, 5+ Zeilen)
6. Preis-Transparenz als TABELLE: Schranktyp | Standard | Premium | Inklusive {#preise-${city || 'region'}}
7. Video-Call-Erklärung (1 Satz)
8. FAQ mit 5-6 stadtspezifischen Fragen — JEDE als H3 mit {#faq-...} Anker, Antwort beginnt mit **1-Satz-Fazit**
9. Lokalkolorit-Block für ${city} {#schreiner-${city || 'region'}}
10. Kontextueller CTA: "${gen.ctaText}"
11. Autoren-Byline + "Zuletzt aktualisiert am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}"

AI-CITATION-PFLICHT:
- Jede H2 muss als eigenständiger Antwort-Baustein funktionieren
- H2s als Fragen formulieren wo möglich: "Was kostet ein Einbauschrank in ${city}?" statt "Preise"
- Alle Daten in Tabellen, nicht im Fließtext
- FAQ-Antworten: erst **1-Satz-Fazit fett**, dann Detail

INTERNE LINKS (natürlich einbauen):
${(strategy.internalLinks || []).map(l => `- ${l.url} (${l.anchor})`).join('\n')}`;

  } else if (gen.pageType === 'PRODUCT_PAGE') {
    prompt = `Erstelle/optimiere die Produktseite für "${product}".

PRIMÄR-KEYWORD: "${gen.primaryKeyword}"
SEKUNDÄR-KEYWORDS: ${(gen.secondaryKeywords || []).join(', ')}
ZIEL-WORTANZAHL: ${gen.targetWordCount} Wörter minimum
PREIS-RANGE: ${gen.priceRange}

PFLICHT-BLÖCKE (AI-Citation-Optimiert):
1. Hero mit H1 = Primär-Keyword
2. INHALTSVERZEICHNIS mit Anker-Links
3. PAS-Opener (Problem → Agitation → Solution)
4. Vorher/Nachher-Beschreibung (mit Bild-Platzhaltern)
5. Material-Deep-Dive (Dekor, Furnier, Beschläge)
6. Kosten-Transparenz als TABELLE: Variante | Standard | Premium | Inklusive {#preise}
7. Vergleichstabelle vs. Konfigurator {#vergleich}
8. 3 Testimonials mit Ergebnis
9. 6+ FAQ-Fragen als H3 mit {#faq-...} Ankern, Antwort mit **1-Satz-Fazit**
10. "Auch verfügbar in: Stuttgart, Ludwigsburg, Heilbronn..." (Orts-LP-Links)
11. Autoren-Byline + Aktualisierungsdatum`;

  } else if (gen.pageType === 'BLOG') {
    prompt = `Erstelle einen Blog-Artikel.

THEMA/KEYWORD: "${gen.primaryKeyword}"
ZIEL-WORTANZAHL: ${gen.targetWordCount} Wörter minimum
AUTOREN-BYLINE: Von Mario Esch, Schreinermeister seit 1985

PFLICHT (AI-Citation-Optimiert):
1. TL;DR Key-Takeaway-Box am Anfang
2. INHALTSVERZEICHNIS mit Anker-Links
3. PAS-Struktur im Body
4. H2s als Fragen formulieren (extrahierbare Antwort-Bausteine)
5. Mindestens 2 zitierbare Datenpunkte/Statistiken IN TABELLEN
6. Interne Links zu Produktseiten + /termin
7. FAQ-Sektion (3-4 Fragen) als H3 mit {#faq-...} und **1-Satz-Fazit**
8. CTA am Ende
9. Autoren-Byline + Aktualisierungsdatum`;

  } else if (gen.pageType === 'PILLAR') {
    prompt = `Erstelle eine Pillar-Page (umfassender Ratgeber).

THEMA: "${gen.primaryKeyword}"
ZIEL-WORTANZAHL: ${gen.targetWordCount} Wörter minimum (mind. 2.500)

PFLICHT (AI-Citation-Optimiert):
1. INHALTSVERZEICHNIS mit Anker-Links (Pflicht, da Pillar >2500 Wörter)
2. Jede H2 als eigenständiger Antwort-Baustein mit {#anker}
3. Vergleichstabellen (Material, Preis, Lieferzeit) als echte Tabellen
4. Mario-Zitate als Experten-Insights
5. Link-Hub zu allen verwandten Seiten
6. 8+ FAQ-Fragen als H3 mit {#faq-...} und **1-Satz-Fazit**
7. Infografik-Platzhalter für key stats
8. Autoren-Byline + Aktualisierungsdatum`;
  }

  prompt += `\n\nWISSENS-KONTEXT (aus RAG-Datenbank):
${contextBlocks}`;

  return prompt;
}

// ── BOARD REVIEW PROMPT ──

const BOARD_SYSTEM = `Du simulierst das 12-Köpfe-Board für MEOS:HELDEN.
Prüfe den Content durch ALLE 12 Perspektiven. Sei STRENG aber FAIR.
Gib für jeden PASS ✅, WARNING ⚠️, oder FAIL ❌ mit 1-Satz-Begründung.

Die 10 Experten:
1. Eli Schwartz — Duplicate/Doorway-Check: ≥40% unique? Variable Struktur?
2. Kevin Indig — Cluster-Architektur: Pillar-Zuordnung sauber? Growth Loop?
3. Olaf Kopp 🇩🇪 — DACH-SEO: Natürliches Deutsch? E-E-A-T komplett? Synonyme?
4. Matthäus Michalik 🇩🇪 — Handwerk-Authentizität: Würde Mario unterschreiben? GBP erwähnt?
5. Joanna Wiebe — Conversion Copy: H1 aus VoC? PAS-Bogen? CTA-Microcopy?
6. Roger Dooley — Friction: Preis-Range mit Leistung? Escape Hatch? Video-Call erklärt?
7. Lily Ray — Schema/E-E-A-T + AI-Citation: Schema komplett? dateModified? Anker-IDs auf H2s? Inhaltsverzeichnis? FAQ mit 1-Satz-Fazit? Jede H2 eigenständig zitierbar?
8. Addy Osmani — Speed: Bilder WebP? Keine Embeds? DOM lean? <1MB geschätzt?
9. Luke Wroblewski — Mobile: Sticky CTA erwähnt? Progressive Disclosure? Touch Targets?
10. Rand Fishkin — Wettbewerb: Besser als Top-3? 2+ Unique Blocks? Competitive Moat?

Die 2 Testkunden:
Sandra K. (34, Stuttgart, iPhone): Sieht sie in 3s das Angebot? Preis? Echte Bilder? 1-Klick-Termin?
Thomas R. (48, Ludwigsburg, iPad): Echte Schreinerei oder Franchise? Referenzen für seinen Fall? Frau überzeugen?

ZUSÄTZLICHER AI-CITATION-CHECK (Lily Ray prüft):
- Hat die Seite ein Inhaltsverzeichnis mit Anker-Links?
- Hat JEDE H2 eine {#anker-id}?
- Sind Preise und Vergleichsdaten in echten Tabellen?
- Beginnt jede FAQ-Antwort mit einem fettgedruckten 1-Satz-Fazit?
- Steht ein "Zuletzt aktualisiert am"-Datum sichtbar?
- Kann jede H2-Sektion als eigenständiger Antwort-Baustein von einer AI zitiert werden?

ANTWORT-FORMAT (exakt einhalten):
✅/⚠️/❌ [Name]: [1 Satz]
...
Sandra K.: JA/NEIN — [1 Satz warum]
Thomas R.: JA/NEIN — [1 Satz warum]
GESAMT: X/10 PASS | X/10 WARNING | X/10 FAIL | Testkunden: X/2 JA`;

function buildBoardReviewPrompt(gen) {
  return `Prüfe diesen generierten Content:

SEITENTYP: ${gen.pageType}
KEYWORD: ${gen.primaryKeyword}
STADT: ${gen.targetCity || 'keine'}
PRODUKT: ${gen.targetProduct || 'allgemein'}
ZIEL-WORTANZAHL: ${gen.targetWordCount}
LAYOUT: ${gen.layoutVariant}
WETTBEWERBS-KONTEXT: Top-3 Ø ${gen.topThreeAvgWords} Wörter

CONTENT:
${gen.outputContent}

META:
Title: ${gen.outputMeta?.title || 'fehlt'}
Description: ${gen.outputMeta?.description || 'fehlt'}
Wortanzahl: ${gen.outputMeta?.wordCount || '?'}

SCHEMA VORHANDEN: ${gen.outputSchema ? 'Ja (' + (Array.isArray(gen.outputSchema) ? gen.outputSchema.length : 1) + ' Blöcke)' : 'Nein'}

AI-CITATION-PRÜFPUNKTE:
- Inhaltsverzeichnis vorhanden? Anker-Links korrekt?
- H2-Anker-IDs vorhanden?
- Preis-Tabelle vorhanden (nicht nur Fließtext)?
- FAQ-Antworten mit 1-Satz-Fazit?
- "Zuletzt aktualisiert" sichtbar?

Führe jetzt den vollständigen Board-Review durch.`;
}

// ── SCHEMA SYSTEM PROMPT ──

const SCHEMA_SYSTEM = `Du bist ein Schema.org-Experte. Generiere valides JSON-LD.
REGELN (Board-Approved + AI-Citation-Optimiert):
- Jeder Schema-Claim MUSS im sichtbaren Content stehen (Board R4)
- dateModified ist PFLICHT — setze es auf das heutige Datum (Board R3 + SISTRIX Säule 2)
- datePublished ist PFLICHT
- BreadcrumbList ist PFLICHT (Board R2)
- Person-Schema für Mario auf JEDER Seite
- FAQPage mit allen FAQ-Fragen und Antworten
- publisher mit Organization-Schema (Schreinerhelden GmbH & Co. KG)
- Antworte NUR mit einem JSON-Array. Kein Markdown, kein Text.

Firma: Schreinerhelden GmbH & Co. KG, Lindenstraße 9-15, 71540 Murrhardt
Tel: +49 7192 935 72 00 | Rating: 4.95/5 (200+ Reviews)
Mario Esch: Schreinermeister & Geschäftsführer, Dozent Meisterschule SHA`;

function buildSchemaPrompt(gen, content) {
  const types = {
    'ORTS_LP': 'Organization, Person, LocalBusiness (areaServed: ' + (gen.targetCity || '?') + '), FAQPage, Product, BreadcrumbList, WebPage',
    'PRODUCT_PAGE': 'Organization, Person, Product, FAQPage, AggregateRating, BreadcrumbList, WebPage',
    'BLOG': 'Organization, Person, Article, FAQPage, BreadcrumbList, WebPage',
    'PILLAR': 'Organization, Person, Article, FAQPage, HowTo, BreadcrumbList, WebPage',
  };

  return `Generiere Schema.org JSON-LD für:
Seitentyp: ${gen.pageType}
Keyword: ${gen.primaryKeyword}
Stadt: ${gen.targetCity || 'keine'}
Produkt: ${gen.targetProduct || 'allgemein'}
Benötigte Typen: ${types[gen.pageType] || 'Organization, Person, BreadcrumbList, WebPage'}

PFLICHT-FELDER (AI-Citation-kritisch):
- datePublished: ${new Date().toISOString().split('T')[0]}
- dateModified: ${new Date().toISOString().split('T')[0]}
- author: { "@type": "Person", "name": "Mario Esch", "jobTitle": "Schreinermeister", "worksFor": "Schreinerhelden GmbH & Co. KG" }
- publisher: { "@type": "Organization", "name": "Schreinerhelden GmbH & Co. KG" }

Content (für FAQ-Extraktion + Claim-Verifizierung):
${content.slice(0, 4000)}`;
}

// ── EXPORT SYSTEM PROMPT ──

const EXPORT_SYSTEM = `Du konvertierst Markdown-Content in WordPress/GenerateBlocks-kompatibles HTML.

REGELN (Board-Approved + AI-Citation-Optimiert):
- SEMANTISCHES HTML: Nutze <article>, <main>, <section>, <nav> statt nur <div>
- Gesamtstruktur: <article> umschließt alles, <nav> für TOC, <section> für jeden H2-Block
- Max DOM-Tiefe: 8 Ebenen (Board R4)
- Max Inline-CSS: 5KB (Board R4)
- Alle Bilder: <img loading="lazy" width="X" height="Y" src="..." alt="...">
- INHALTSVERZEICHNIS als <nav aria-label="Inhaltsverzeichnis"> mit <ol> und Anker-Links
- JEDE H2 bekommt eine id="..." (kebab-case des Titels)
- JEDE H2-Sektion in <section id="..."> gewrapped
- Sticky CTA: scroll-triggered, dismissable, 80px padding-bottom, NICHT unter Cookie-Banner
- FAQ als Accordion (<details>/<summary>) für Progressive Disclosure (Board R3)
  JEDE FAQ-Frage hat eine id: <details id="faq-...">
- VERGLEICHSTABELLEN und PREIS-TABELLEN als echte <table> mit <thead>/<tbody>
- GenerateBlocks CSS-Klassen: gb-container, gb-headline, gb-button
- Schema.org als separater <script type="application/ld+json"> Block
- "Zuletzt aktualisiert am" sichtbar als <time datetime="..."> Element
- Kein Elementor-Markup (Board R4: GenerateBlocks statt Elementor)

OUTPUT: Nur HTML. Kein Markdown, kein erklärender Text.`;

function buildExportPrompt(gen) {
  return `Konvertiere diesen Content in WordPress/GenerateBlocks-HTML.

WICHTIG — SEMANTISCHE STRUKTUR:
- Wrap alles in <article>
- TOC in <nav aria-label="Inhaltsverzeichnis">
- Jede H2-Sektion in <section id="...">
- Preise/Vergleiche als echte <table>
- FAQ als <details>/<summary> mit id="faq-..."
- Autoren-Byline + <time datetime="${new Date().toISOString().split('T')[0]}">Zuletzt aktualisiert am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</time>

CONTENT (Markdown):
${gen.outputContent}

SCHEMA (als <script> Block einbauen):
${JSON.stringify(gen.outputSchema, null, 2)}

META:
Title: ${gen.outputMeta?.title}
Description: ${gen.outputMeta?.description}

CTA-TEXT: ${gen.ctaText || 'Jetzt Termin buchen'}
CTA-URL: /termin
PREIS-RANGE: ${gen.priceRange || ''}

Baue den Sticky Mobile CTA als letztes Element ein:
<div class="hf-sticky-cta" style="position:fixed;bottom:0;left:0;right:0;z-index:999;background:#EE7E00;padding:12px;text-align:center;display:none;" id="stickyCta">
  <a href="/termin" style="color:#fff;font-weight:700;text-decoration:none;font-size:16px;">${gen.ctaText || 'Jetzt Termin buchen'}</a>
  <button onclick="this.parentElement.style.display='none'" style="position:absolute;right:8px;top:8px;background:none;border:none;color:#fff;font-size:18px;">✕</button>
</div>
<script>window.addEventListener('scroll',function(){document.getElementById('stickyCta').style.display=window.scrollY>400?'block':'none';})</script>`;
}

module.exports = {
  buildSystemPrompt, buildUserPrompt,
  BOARD_SYSTEM, buildBoardReviewPrompt,
  SCHEMA_SYSTEM, buildSchemaPrompt,
  EXPORT_SYSTEM, buildExportPrompt,
};
