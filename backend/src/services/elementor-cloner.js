// ============================================
// MEOS:HELDEN — Elementor Template Cloner
// Takes Stuttgart master template, fills with new city content
// ============================================

const fs = require('fs');
const path = require('path');

// Load master template once
const MASTER_PATH = path.join(__dirname, '..', 'templates', 'orts-lp-master.json');
let masterTemplate = null;

// Master template page ID in WordPress (Stuttgart LP)
const MASTER_WP_PAGE_ID = 9741;

async function getMaster() {
  if (masterTemplate) return JSON.parse(JSON.stringify(masterTemplate));

  // Try local file first
  try {
    if (fs.existsSync(MASTER_PATH)) {
      const raw = fs.readFileSync(MASTER_PATH, 'utf-8');
      masterTemplate = JSON.parse(raw);
      console.log(`✅ Master-Template geladen (lokal, ${Math.round(raw.length/1024)}KB)`);
      return JSON.parse(JSON.stringify(masterTemplate));
    }
  } catch (e) {
    console.warn(`⚠️ Lokales Template nicht lesbar: ${e.message}`);
  }

  // Fallback: Fetch from WordPress API
  console.log('📡 Lade Master-Template von WordPress...');
  const wpUrl = process.env.WP_URL || 'https://schreinerhelden.de';
  const wpUser = process.env.WP_USER;
  const wpAppPassword = process.env.WP_APP_PASSWORD;

  if (!wpUser || !wpAppPassword) throw new Error('Master-Template nicht gefunden und keine WP-Credentials für Fallback.');

  const auth = Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64');
  const res = await fetch(`${wpUrl}/wp-json/wp/v2/pages/${MASTER_WP_PAGE_ID}?context=edit`, {
    headers: { 'Authorization': `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`WordPress API ${res.status}: Template-Seite ${MASTER_WP_PAGE_ID} nicht erreichbar.`);

  const page = await res.json();
  const edata = page?.meta?._elementor_data;
  if (!edata) throw new Error('Keine Elementor-Daten auf der Master-Seite gefunden.');

  masterTemplate = typeof edata === 'string' ? JSON.parse(edata) : edata;
  console.log(`✅ Master-Template von WordPress geladen (${Math.round(JSON.stringify(masterTemplate).length/1024)}KB)`);

  // Cache locally for next time
  try {
    const dir = path.dirname(MASTER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MASTER_PATH, JSON.stringify(masterTemplate), 'utf-8');
    console.log('💾 Template lokal gecacht.');
  } catch (e) {
    console.warn(`⚠️ Konnte Template nicht lokal cachen: ${e.message}`);
  }

  return JSON.parse(JSON.stringify(masterTemplate));
}

// Random Elementor-style ID
function eid() {
  return Math.random().toString(36).slice(2, 9);
}

// Regenerate all IDs in template (Elementor needs unique IDs per page)
function regenerateIds(elements) {
  for (const el of elements) {
    el.id = eid();
    if (el.elements && el.elements.length > 0) {
      regenerateIds(el.elements);
    }
  }
}

// Parse markdown content into structured sections
function parseContent(markdown) {
  const result = {
    h1: '',
    intro: '',
    sections: [],  // { title, id, body, type }
    faq: [],       // { question, answer }
    schema: null,
  };

  // Extract H1
  const h1Match = markdown.match(/^#\s+(.+?)(?:\s*\{#[^}]+\})?$/m);
  if (h1Match) result.h1 = h1Match[1].trim();

  // Extract intro (between H1 and first H2)
  const firstH2 = markdown.match(/^##\s+/m);
  if (h1Match && firstH2) {
    result.intro = markdown.slice(h1Match.index + h1Match[0].length, firstH2.index).trim();
  }

  // Extract H2 sections
  const h2Regex = /^##\s+(.+?)(?:\s*\{#([^}]+)\})?$/gm;
  const matches = [...markdown.matchAll(h2Regex)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    const body = markdown.slice(m.index + m[0].length, nextStart).trim();
    const title = m[1].trim();
    const id = m[2] || '';
    const lower = title.toLowerCase();

    // Skip TOC section
    if (lower === 'inhalt' || lower === 'inhaltsverzeichnis' || lower.startsWith('auf dieser seite')) continue;

    // Classify section type
    let type = 'text';
    if (lower.includes('warum') && (lower.includes('schreiner') || lower.includes('konfigurator'))) type = 'differenzierung';
    else if (lower.includes('kostet') || lower.includes('preis')) type = 'preise';
    else if (lower.includes('faq') || lower.includes('häufig') || lower.includes('fragen')) type = 'faq';
    else if (lower.includes('schreiner für') || lower.includes('schreiner in') || lower.includes('dein schreiner')) type = 'lokalkolorit';
    else if (lower.includes('herausforderung') || lower.includes('problem') || lower.includes('raum')) type = 'pain';
    else if (lower.includes('lösung') || lower.includes('maßgefertigt') || lower.includes('maßgeschneidert')) type = 'solution';
    else if (lower.includes('referenz') || lower.includes('kunden') || lower.includes('erfahrung') || lower.includes('sagen')) type = 'testimonials';
    else if (lower.includes('jetzt') || lower.includes('termin') || lower.includes('planen')) type = 'cta';
    else if (lower.includes('vergleich') || lower.includes(' vs')) type = 'vergleich';
    else if (lower.includes('video') || lower.includes('planungstermin')) type = 'videocall';

    // Parse FAQ items from body
    if (type === 'faq') {
      const faqRegex = /###\s+(.+?)(?:\s*\{#[^}]+\})?\n([\s\S]*?)(?=###\s|$)/g;
      let faqMatch;
      while ((faqMatch = faqRegex.exec(body))) {
        result.faq.push({
          question: faqMatch[1].trim(),
          answer: faqMatch[2].trim().replace(/\*\*/g, ''),
        });
      }
    }

    result.sections.push({ title, id, body, type });
  }

  return result;
}

// Convert markdown text to simple HTML
function mdToHtml(md) {
  if (!md) return '';
  return md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\[BILD:\s*([^\]]+)\]/g, '<p style="background:#f0f0f0;padding:20px;text-align:center;border-radius:8px;color:#999;">📷 $1</p>')
    .split('\n\n')
    .map(p => {
      p = p.trim();
      if (!p || p.startsWith('<') || p.startsWith('|')) return p;
      if (p.startsWith('###')) return '';
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

// Convert markdown table to responsive HTML (Desktop: table, Mobile: cards)
function tableToHtml(md, tableType = 'generic') {
  const tableMatch = md.match(/(\|.+\|\n\|[-|\s]+\|\n(?:\|.+\|\n?)+)/);
  if (!tableMatch) return '';
  const lines = tableMatch[0].trim().split('\n');
  const parseRow = l => l.split('|').map(c => c.trim()).filter(c => c);
  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);
  const cls = `sh-tbl-${Date.now().toString(36)}`;

  // Desktop table
  let html = `<style>
.${cls}-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
.${cls} { width:100%; border-collapse:collapse; min-width:480px; }
.${cls} th { background:#EE7E00; color:#fff; padding:12px 14px; text-align:left; font-weight:600; font-size:14px; }
.${cls} td { padding:12px 14px; border-bottom:1px solid #eee; font-size:14px; }
.${cls} tr:nth-child(odd) td { background:#f9f9f9; }
.${cls} td:first-child { font-weight:600; }
.${cls}-cards { display:none; }
.${cls}-card { background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; margin-bottom:10px; }
.${cls}-card-title { font-weight:700; font-size:15px; color:#333; margin-bottom:10px; padding-bottom:8px; border-bottom:2px solid #EE7E00; }
.${cls}-card-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f0f0; gap:8px; }
.${cls}-card-row:last-child { border:none; }
.${cls}-card-label { color:#888; font-size:13px; min-width:90px; flex-shrink:0; }
.${cls}-card-val { font-weight:600; color:#333; font-size:14px; text-align:right; }
@media (max-width:767px) {
  .${cls}-scroll { display:none !important; }
  .${cls}-cards { display:block !important; }
}
</style>`;

  html += `<div class="${cls}-scroll"><table class="${cls}"><thead><tr>`;
  headers.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => { html += `<td>${cell}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // Mobile cards (first column = card title, rest = rows)
  html += `<div class="${cls}-cards">`;
  rows.forEach(row => {
    html += `<div class="${cls}-card">`;
    html += `<div class="${cls}-card-title">${row[0] || ''}</div>`;
    for (let i = 1; i < headers.length && i < row.length; i++) {
      html += `<div class="${cls}-card-row"><span class="${cls}-card-label">${headers[i]}</span><span class="${cls}-card-val">${row[i]}</span></div>`;
    }
    html += '</div>';
  });
  html += '</div>';

  return html;
}

// Walk through elements and find widgets by type
function findWidgets(elements, widgetType = null) {
  const found = [];
  for (const el of elements) {
    if (el.elType === 'widget') {
      if (!widgetType || el.widgetType === widgetType) found.push(el);
    }
    if (el.elements) found.push(...findWidgets(el.elements, widgetType));
  }
  return found;
}

// Find section containing a specific widget type (top-level container/section)
function findSectionWith(elements, test) {
  for (let i = 0; i < elements.length; i++) {
    const widgets = findWidgets([elements[i]]);
    if (widgets.some(test)) return { index: i, element: elements[i] };
  }
  return null;
}

// ════════════════════════════════════
// MAIN CLONE FUNCTION
// ════════════════════════════════════

async function cloneTemplate(generation) {
  // ═══ GUARD: Pipeline-Content ist PFLICHT ═══
  if (!generation.outputContent || generation.outputContent.length < 500) {
    throw new Error('STOP: Kein Pipeline-Content vorhanden! Der Cloner darf NICHT ohne die 6-Stufen-Pipeline arbeiten. Erst Pipeline starten, dann pushen.');
  }

  const content = parseContent(generation.outputContent);
  if (content.sections.length < 3) {
    throw new Error(`STOP: Nur ${content.sections.length} Sektionen im Pipeline-Content. Mindestens 5 erwartet. Pipeline hat nicht genug Content generiert.`);
  }

  console.log(`\n🔧 Cloner: ${content.sections.length} Sektionen, ${content.faq.length} FAQ, H1: "${content.h1?.slice(0,40)}"`);

  const template = await getMaster();
  regenerateIds(template);

  const meta = generation.outputMeta || {};
  const cityName = generation.targetCity || '';
  const cityNameCapitalized = cityName.charAt(0).toUpperCase() + cityName.slice(1);

  // Helper: find and replace text in widget
  function replaceWidgetText(widget, newText) {
    if (!widget || !widget.settings) return;
    if (widget.widgetType === 'heading') widget.settings.title = newText;
    else if (widget.widgetType === 'text-editor') widget.settings.editor = newText;
    else if (widget.widgetType === 'html') widget.settings.html = newText;
    else if (widget.widgetType === 'button') widget.settings.text = newText;
  }

  // ── Replace H1 (first heading) ──
  const allHeadings = findWidgets(template, 'heading');
  if (allHeadings.length > 0 && content.h1) {
    allHeadings[0].settings.title = content.h1;
  }

  // ── Replace intro text ──
  const allTexts = findWidgets(template, 'text-editor');
  if (allTexts.length > 0 && content.intro) {
    allTexts[0].settings.editor = mdToHtml(content.intro);
  }

  // ═══════════════════════════════════════════════════════════
  // CONTENT INJECTION: Pipeline-Content füllt ALLE Sektionen
  // Jede Template-Sektion mit H2 bekommt Pipeline-Content.
  // Kein reines Find-Replace — echte neue Texte aus RAG-Chunks.
  // ═══════════════════════════════════════════════════════════

  const pipelineSections = content.sections.filter(s => s.title);
  const usedIdx = new Set();

  // Find best pipeline section for a template section
  function findBest(headingText, expectedType) {
    const ht = headingText.toLowerCase();
    // 1. Exact type match (unused)
    if (expectedType) {
      for (let j = 0; j < pipelineSections.length; j++) {
        if (!usedIdx.has(j) && pipelineSections[j].type === expectedType) {
          usedIdx.add(j); return pipelineSections[j];
        }
      }
    }
    // 2. Keyword overlap
    const htWords = new Set(ht.replace(/[^a-zäöüß\s]/g, '').split(/\s+/).filter(w => w.length > 3));
    let bestJ = -1, bestScore = 0;
    for (let j = 0; j < pipelineSections.length; j++) {
      if (usedIdx.has(j)) continue;
      const pw = new Set(pipelineSections[j].title.toLowerCase().replace(/[^a-zäöüß\s]/g, '').split(/\s+/).filter(w => w.length > 3));
      let score = 0;
      for (const w of htWords) { if (pw.has(w)) score++; }
      if (score > bestScore) { bestScore = score; bestJ = j; }
    }
    if (bestJ >= 0 && bestScore >= 1) { usedIdx.add(bestJ); return pipelineSections[bestJ]; }
    // 3. Next unused (sequential)
    for (let j = 0; j < pipelineSections.length; j++) {
      if (!usedIdx.has(j)) { usedIdx.add(j); return pipelineSections[j]; }
    }
    return null;
  }

  // Type detector from heading text
  function detectType(ht) {
    ht = ht.toLowerCase();
    if (ht.includes('warum') && (ht.includes('schreiner') || ht.includes('konfigurator'))) return 'differenzierung';
    if (ht.includes('warum') && ht.includes('dachschräge')) return 'pain';
    if (ht.includes('herausforderung') || ht.includes('ungenutzt')) return 'pain';
    if (ht.includes('lösung') || ht.includes('maßgefertigt')) return 'solution';
    if (ht.includes('erfahrung') || ht.includes('kunden') || ht.includes('referenz')) return 'testimonials';
    if (ht.includes('vergleich') || ht.includes(' vs')) return 'vergleich';
    if (ht.includes('preis') || ht.includes('kostet')) return 'preise';
    if (ht.includes('faq') || ht.includes('fragen') || ht.includes('häufig')) return 'faq';
    if (ht.includes('lokalkolorit') || ht.includes('schreiner für') || ht.includes('und wir') || ht.includes('qualität')) return 'lokalkolorit';
    if (ht.includes('termin') || ht.includes('jetzt') || ht.includes('planen')) return 'cta';
    if (ht.includes('planungstermin') || ht.includes('video') || ht.includes('online-termin')) return 'videocall';
    return null;
  }

  // Inject content into template
  function injectContent(sectionEl, matched) {
    const headings = findWidgets([sectionEl], 'heading');
    const texts = findWidgets([sectionEl], 'text-editor');
    const htmlWidgets = findWidgets([sectionEl], 'html').filter(w => !(w.settings?.html || '').includes('ld+json'));
    const accordions = findWidgets([sectionEl], 'accordion');
    const toggles = findWidgets([sectionEl], 'toggle');

    // Replace heading
    if (headings.length > 0) headings[0].settings.title = matched.title;

    // Replace text content
    if (texts.length > 0) {
      if (matched.body.includes('|') && matched.body.includes('---')) {
        const tableHtml = tableToHtml(matched.body);
        const parts = matched.body.split(/\|.+\|\n\|[-|\s]+\|\n(?:\|.+\|\n?)+/);
        texts[0].settings.editor = mdToHtml(parts[0] || '') + (parts[1] ? mdToHtml(parts[1]) : '');
        if (htmlWidgets.length > 0) htmlWidgets[0].settings.html = tableHtml;
      } else {
        texts[0].settings.editor = mdToHtml(matched.body);
      }
      // Clear remaining text widgets (prevent old content leak)
      for (let t = 1; t < texts.length; t++) {
        const old = texts[t].settings?.editor || '';
        // Don't clear CTA microcopy or short design-text
        if (old.length > 200) texts[t].settings.editor = '';
      }
    }

    // Replace FAQ accordion
    if (matched.type === 'faq' && content.faq.length > 0) {
      const acc = accordions[0] || toggles[0];
      if (acc) {
        acc.settings.tabs = content.faq.map(faq => ({
          _id: eid(),
          tab_title: faq.question,
          tab_content: `<p>${faq.answer.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
        }));
      }
    }
  }

  // Walk ALL template sections
  for (let i = 0; i < template.length; i++) {
    const headings = findWidgets([template[i]], 'heading');
    if (headings.length === 0) continue;
    const headingText = headings[0].settings?.title || '';
    const tag = headings[0].settings?.header_size || 'h2';
    if (tag === 'h1') continue; // H1 already handled

    const expectedType = detectType(headingText);
    const matched = findBest(headingText, expectedType);

    if (matched) {
      injectContent(template[i], matched);
      console.log(`  📝 [${i}] "${headingText.slice(0,35)}" → "${matched.title.slice(0,35)}" (${matched.type})`);
    } else {
      console.log(`  ⚪ [${i}] "${headingText.slice(0,35)}" — kein Pipeline-Match`);
    }
  }

  console.log(`  📊 Pipeline: ${usedIdx.size}/${pipelineSections.length} Sektionen injected`);

  // ── Replace CTA button texts ──
  const buttons = findWidgets(template, 'button');
  const ctaText = generation.ctaText || `Jetzt Schrank in ${cityNameCapitalized} planen`;
  buttons.forEach(btn => {
    if (btn.settings?.text) {
      btn.settings.text = ctaText;
    }
    if (btn.settings?.link) {
      btn.settings.link.url = '/termin';
    }
  });

  // ── Strip Jahreszahlen from Testimonials ──
  const testimonialWidgets = findWidgets(template, 'testimonial-carousel');
  for (const tw of testimonialWidgets) {
    const slides = tw.settings?.slides || [];
    for (const slide of slides) {
      if (slide.name) {
        // Remove dates like "23.07.2024", "28.03.2025"
        slide.name = slide.name.replace(/\d{2}\.\d{2}\.\d{4}/g, '').replace(/\s*[·,]\s*$/, '').trim();
      }
    }
  }

  // ── Set H2 Anker-IDs (CSS IDs on heading widgets) ──
  for (const h of allHeadings) {
    const tag = h.settings?.header_size || 'h2';
    if (tag === 'h2') {
      const title = h.settings?.title || '';
      if (title && !h.settings?._element_id) {
        // Generate kebab-case ID from title
        const ankerId = title
          .toLowerCase()
          .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
          .replace(/<[^>]+>/g, '')  // Strip HTML tags like <br>
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 50);
        h.settings._element_id = ankerId;
      }
    }
  }

  // ── Replace Schema JSON-LD (Full 10-Block Stack) ──
  const htmlWidgets = findWidgets(template, 'html');
  const schemaWidget = htmlWidgets.find(w =>
    (w.settings?.html || '').includes('application/ld+json') || (w.settings?.html || '').includes('schema')
  );
  if (schemaWidget && generation.outputSchema) {
    const schema = typeof generation.outputSchema === 'string'
      ? JSON.parse(generation.outputSchema) : generation.outputSchema;

    if (schema.htmlScript) {
      // New format: deterministischer Generator mit htmlScript (multiple <script> tags)
      schemaWidget.settings.html = schema.htmlScript;
      console.log(`📋 Schema: ${schema.summary?.schemaCount || '?'} JSON-LD Blöcke injiziert (${schema.summary?.types?.join(', ') || '?'})`);
    } else if (Array.isArray(schema)) {
      // Legacy: Array of schema objects from old GPT-4o call
      schemaWidget.settings.html = schema
        .map(b => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`)
        .join('\n');
      console.log(`📋 Schema: ${schema.length} JSON-LD Blöcke injiziert (Legacy-Format)`);
    } else {
      // Legacy: Single schema object
      schemaWidget.settings.html = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
      console.log('📋 Schema: 1 JSON-LD Block injiziert (Legacy-Format)');
    }
  } else if (!schemaWidget && generation.outputSchema) {
    // Kein Schema-Widget im Template → als neues HTML-Widget am Ende einfügen
    const schema = typeof generation.outputSchema === 'string'
      ? JSON.parse(generation.outputSchema) : generation.outputSchema;
    const schemaHtml = schema.htmlScript
      || (Array.isArray(schema)
        ? schema.map(b => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`).join('\n')
        : `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`);

    // Append as last element in the template
    template.push({
      id: eid(),
      elType: 'widget',
      widgetType: 'html',
      settings: { html: schemaHtml },
      elements: [],
    });
    console.log('📋 Schema: Neues HTML-Widget am Seitenende eingefügt');
  }

  // ── Replace byline date ──
  const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  for (const tw of allTexts) {
    const ed = tw.settings?.editor || '';
    if (ed.includes('Mario Esch') && (ed.includes('aktualisiert') || ed.includes('Schreinermeister'))) {
      tw.settings.editor = `<div style="text-align:center;color:#666;font-size:14px;padding:20px 0;">Von <strong>Mario Esch</strong>, Schreinermeister seit 1985, Dozent an der Meisterschule Schwäbisch Hall<br><time datetime="${new Date().toISOString().split('T')[0]}">Zuletzt aktualisiert am ${dateStr}</time></div>`;
    }
  }

  // ═══════════════════════════════════════════════════
  // ANTI-DUPLICATE-CONTENT: Global City Replacement
  // Replaces "Stuttgart" with new city name in ALL widgets
  // This catches the ~32% "fixed" content that would be identical
  // ═══════════════════════════════════════════════════

  if (cityNameCapitalized && cityNameCapitalized.toLowerCase() !== 'stuttgart') {
    // Walk ALL widgets recursively and replace city references
    function replaceCityInWidgets(elements) {
      for (const el of elements) {
        const s = el.settings || {};

        // Heading widgets
        if (el.widgetType === 'heading' && s.title) {
          s.title = s.title.replace(/Stuttgart/g, cityNameCapitalized).replace(/stuttgart/g, cityName);
        }

        // Text Editor widgets
        if (el.widgetType === 'text-editor' && s.editor) {
          s.editor = s.editor.replace(/Stuttgart/g, cityNameCapitalized).replace(/stuttgart/g, cityName);
        }

        // HTML widgets (but not Schema — Schema gets replaced separately)
        if (el.widgetType === 'html' && s.html && !s.html.includes('ld+json')) {
          s.html = s.html.replace(/Stuttgart/g, cityNameCapitalized).replace(/stuttgart/g, cityName);
        }

        // Button widgets
        if (el.widgetType === 'button' && s.text) {
          s.text = s.text.replace(/Stuttgart/g, cityNameCapitalized).replace(/stuttgart/g, cityName);
        }

        // Icon-Box widgets (title + description)
        if (el.widgetType === 'icon-box') {
          if (s.title_text) s.title_text = s.title_text.replace(/Stuttgart/g, cityNameCapitalized);
          if (s.description_text) s.description_text = s.description_text.replace(/Stuttgart/g, cityNameCapitalized);
        }

        // Call-to-Action widgets
        if (el.widgetType === 'call-to-action') {
          if (s.title) s.title = s.title.replace(/Stuttgart/g, cityNameCapitalized);
          if (s.description) s.description = s.description.replace(/Stuttgart/g, cityNameCapitalized);
        }

        // Accordion / Toggle (FAQ)
        if ((el.widgetType === 'accordion' || el.widgetType === 'toggle') && s.tabs) {
          for (const tab of s.tabs) {
            if (tab.tab_title) tab.tab_title = tab.tab_title.replace(/Stuttgart/g, cityNameCapitalized);
            if (tab.tab_content) tab.tab_content = tab.tab_content.replace(/Stuttgart/g, cityNameCapitalized);
          }
        }

        // Testimonial Carousel — add city context to names
        if (el.widgetType === 'testimonial-carousel' && s.slides) {
          for (const slide of s.slides) {
            if (slide.name) {
              slide.name = slide.name.replace(/Stuttgart/g, cityNameCapitalized).replace(/aus der Region/g, `aus ${cityNameCapitalized}`);
            }
          }
        }

        // Recurse into children
        if (el.elements) replaceCityInWidgets(el.elements);
      }
    }

    replaceCityInWidgets(template);
    console.log(`🔄 Anti-Duplicate: "Stuttgart" → "${cityNameCapitalized}" in allen Widgets ersetzt`);
  }

  // ── Replace Referenzen intro with city-specific version ──
  for (const tw of allTexts) {
    const ed = tw.settings?.editor || '';
    if (ed.includes('In vielen Häusern und Wohnungen sind Räume mit Dachschrägen')) {
      tw.settings.editor = tw.settings.editor
        .replace(
          /In vielen Häusern und Wohnungen sind Räume mit Dachschrägen eine Herausforderung[^.]*\./,
          `In ${cityNameCapitalized} kennen wir die typischen Wohnsituationen — von Altbauten mit verwinkelten Dachgeschossen bis zu modernen Neubauten mit besonderen Grundrissen.`
        );
    }
  }

  // ── Replace generic "Dein persönlicher Online-Planungstermin" text ──
  for (const tw of allTexts) {
    const ed = tw.settings?.editor || '';
    if (ed.includes('Online-Termin planen wir gemeinsam') && !ed.includes(cityNameCapitalized)) {
      tw.settings.editor = ed.replace(
        /deinen maßgefertigten Schrank/,
        `deinen maßgefertigten Schrank für dein Zuhause in ${cityNameCapitalized}`
      );
    }
  }

  return template;
}

// ════════════════════════════════════
// WORDPRESS PUSH
// ════════════════════════════════════

async function pushToWordPress(generation, elementorData) {
  const wpUrl = process.env.WP_URL || 'https://schreinerhelden.de';
  const wpUser = process.env.WP_USER;
  const wpAppPassword = process.env.WP_APP_PASSWORD;

  if (!wpUser || !wpAppPassword) throw new Error('WordPress Credentials nicht konfiguriert (WP_USER + WP_APP_PASSWORD)');

  const meta = generation.outputMeta || {};
  const citySlug = generation.targetCity || 'region';
  const slug = `schreiner-${citySlug}`;
  const auth = Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64');

  // Step 1: Create page as draft
  const createRes = await fetch(`${wpUrl}/wp-json/wp/v2/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
    body: JSON.stringify({
      title: meta.title || generation.primaryKeyword,
      slug,
      status: 'draft',
      content: '', // Content lives in Elementor data, not here
      meta: {
        _elementor_edit_mode: 'builder',
        _elementor_template_type: 'wp-page',
        _elementor_data: JSON.stringify(elementorData),
        _elementor_page_settings: {
          custom_css: 'html, body { overflow-x: hidden; margin: 0; padding: 0; width: 100%; }\nimg { max-width: 100%; height: auto; }',
        },
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`WordPress API ${createRes.status}: ${errText.slice(0, 300)}`);
  }

  const wpPage = await createRes.json();

  // Step 2: Try to set Yoast/RankMath SEO meta via second update
  try {
    await fetch(`${wpUrl}/wp-json/wp/v2/pages/${wpPage.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({
        meta: {
          _yoast_wpseo_title: meta.title || '',
          _yoast_wpseo_metadesc: meta.description || '',
        },
      }),
    });
  } catch (e) { /* Yoast may not be installed, ignore */ }

  return {
    wpId: wpPage.id,
    wpUrl: wpPage.link,
    slug,
    title: wpPage.title?.rendered || meta.title,
    status: 'draft',
  };
}

module.exports = { cloneTemplate, pushToWordPress, parseContent };
