// ============================================
// MEOS:HELDEN — Schema.org Generator v1.0
// Deterministisch, kein GPT-4o Call nötig
// Ersetzt den alten SCHEMA_SYSTEM Prompt
// ============================================

const BASE_URL = 'https://schreinerhelden.de';

const BASE = {
  companyName: 'Schreinerhelden',
  legalName: 'Schreinerhelden GmbH & Co. KG',
  url: BASE_URL,
  logo: `${BASE_URL}/wp-content/uploads/2023/11/Schreinerhelden_2022_lang_RGB-1-scaled.jpg`,
  telephone: '+497192978901',
  email: 'info@schreinerhelden.de',
  address: {
    streetAddress: 'Lindenstraße 9-15',
    addressLocality: 'Murrhardt',
    postalCode: '71540',
    addressRegion: 'Baden-Württemberg',
    addressCountry: 'DE',
  },
  geo: { latitude: '48.9808', longitude: '9.5789' },
  rating: { ratingValue: '4.95', bestRating: '5', ratingCount: '200', reviewCount: '200' },
  sameAs: [
    'https://www.instagram.com/schreinerhelden/',
    'https://www.facebook.com/schreinerhelden/',
    'https://www.provenexpert.com/schreinerhelden/',
  ],
  openingHours: {
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '07:30',
    closes: '17:00',
  },
};

const MARIO = {
  name: 'Mario Esch',
  jobTitle: 'Schreinermeister & Geschäftsführer',
  description: 'Schreinermeister mit über 40 Jahren Erfahrung. Betriebswirt des Handwerks. Dozent an der Schreiner Meisterschule Schwäbisch Hall. Gründer der Schreinerhelden.',
  knowsAbout: [
    'Einbauschränke nach Maß', 'Dachschrägenschränke', 'Begehbare Kleiderschränke',
    'Möbelbau', 'Schreinerhandwerk', 'CNC-Fertigung', 'Digitales Handwerk', 'KI im Handwerk',
  ],
  sameAs: ['https://marioesch.de', 'https://linkedin.com/in/mario-esch/', 'https://ihr-moebel-schreiner.de'],
};

const PRODUCTS = {
  'Dachschrägenschrank': {
    name: 'Dachschrägenschrank nach Maß',
    sku: 'SH-DSS-MASS',
    price: '2900',
    desc: 'Ab 2.900 € für einen 3m breiten Schrank inkl. Aufmaß, Fertigung, Lieferung und Montage',
    urlPath: '/dachschraegenschrank',
  },
  'Einbauschrank': {
    name: 'Einbauschrank nach Maß',
    sku: 'SH-EBS-MASS',
    price: '2400',
    desc: 'Ab 2.400 € für einen Einbauschrank inkl. Aufmaß, Fertigung, Lieferung und Montage',
    urlPath: '/einbauschrank',
  },
  'Begehbarer Kleiderschrank': {
    name: 'Begehbarer Kleiderschrank nach Maß',
    sku: 'SH-BGK-MASS',
    price: '4500',
    desc: 'Ab 4.500 € für einen begehbaren Kleiderschrank inkl. Aufmaß, Fertigung, Lieferung und Montage',
    urlPath: '/begehbarer-kleiderschrank',
  },
  'Schiebetürenschrank': {
    name: 'Schiebetürenschrank nach Maß',
    sku: 'SH-STS-MASS',
    price: '3200',
    desc: 'Ab 3.200 € für einen Schiebetürenschrank inkl. Aufmaß, Fertigung, Lieferung und Montage',
    urlPath: '/schiebetuerenschrank',
  },
};


// ─────────────────────────────────────────────
// SCHEMA BLOCK GENERATORS
// ─────────────────────────────────────────────

function schemaOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE.url}/#organization`,
    name: BASE.companyName,
    legalName: BASE.legalName,
    url: BASE.url,
    logo: { '@type': 'ImageObject', url: BASE.logo },
    telephone: BASE.telephone,
    email: BASE.email,
    address: { '@type': 'PostalAddress', ...BASE.address },
    founder: { '@type': 'Person', '@id': `${BASE.url}/#mario-esch` },
    aggregateRating: { '@type': 'AggregateRating', ...BASE.rating },
    sameAs: BASE.sameAs,
  };
}

function schemaPerson() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${BASE.url}/#mario-esch`,
    name: MARIO.name,
    jobTitle: MARIO.jobTitle,
    worksFor: { '@type': 'Organization', '@id': `${BASE.url}/#organization`, name: BASE.companyName },
    knowsAbout: MARIO.knowsAbout,
    description: MARIO.description,
    sameAs: MARIO.sameAs,
  };
}

/**
 * @param {Object} city - city_profiles row from DB
 */
function schemaLocalBusiness(city) {
  const stadtteile = city.stadtteile || [];
  const slug = `schreiner-${city.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${BASE.url}/${slug}/#localbusiness`,
    name: `Schreinerhelden — Schreiner in ${city.name}`,
    description: `Maßgefertigte Einbauschränke und Dachschrägenschränke für ${city.name} und Umgebung. Aufmaß, Fertigung und Montage aus einer Hand. ${city.fahrtzeitMin || city.entfernungKm || '?'} Minuten von unserer Werkstatt in Murrhardt.`,
    url: `${BASE.url}/${slug}`,
    telephone: BASE.telephone,
    email: BASE.email,
    image: BASE.logo,
    address: { '@type': 'PostalAddress', ...BASE.address },
    geo: { '@type': 'GeoCoordinates', ...BASE.geo },
    areaServed: [
      {
        '@type': 'City',
        name: city.name,
        ...(city.wikidataId ? { sameAs: `https://www.wikidata.org/wiki/${city.wikidataId}` } : {}),
      },
      ...stadtteile.map(st => ({ '@type': 'Place', name: typeof st === 'string' ? (st.includes(city.name) ? st : `${city.name}-${st}`) : st })),
    ],
    serviceArea: {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', ...BASE.geo },
      geoRadius: '80000',
    },
    priceRange: '€€–€€€',
    currenciesAccepted: 'EUR',
    paymentAccepted: 'Überweisung, Bar, EC-Karte',
    aggregateRating: { '@type': 'AggregateRating', ...BASE.rating },
    openingHoursSpecification: { '@type': 'OpeningHoursSpecification', ...BASE.openingHours },
    founder: { '@type': 'Person', '@id': `${BASE.url}/#mario-esch` },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Maßmöbel-Leistungen',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Dachschrägenschrank nach Maß in ${city.name}` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Einbauschrank nach Maß in ${city.name}` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Begehbarer Kleiderschrank in ${city.name}` } },
      ],
    },
    sameAs: BASE.sameAs,
  };
}

function schemaProduct(city, productKey) {
  const p = PRODUCTS[productKey] || PRODUCTS['Dachschrägenschrank'];
  const cityLabel = city ? ` in ${city.name}` : '';

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${p.name}${cityLabel}`,
    description: `Maßgefertigter ${p.name.replace(' nach Maß', '')}${cityLabel} — individuell geplant, in Murrhardt gefertigt, bei Ihnen montiert.`,
    sku: p.sku,
    brand: { '@type': 'Brand', name: 'Schreinerhelden' },
    manufacturer: { '@type': 'Organization', '@id': `${BASE.url}/#organization` },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: p.price,
      priceValidUntil: `${new Date().getFullYear()}-12-31`,
      availability: 'https://schema.org/InStock',
      url: `${BASE.url}${p.urlPath}`,
      description: p.desc,
      ...(city ? { areaServed: { '@type': 'City', name: city.name } } : {}),
      seller: { '@type': 'Organization', '@id': `${BASE.url}/#organization` },
    },
    aggregateRating: { '@type': 'AggregateRating', ...BASE.rating },
    image: BASE.logo,
  };
}

function schemaFAQPage(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

function schemaHowTo(city) {
  const cityLabel = city ? ` in ${city.name}` : '';
  const fahrzeit = city?.fahrtzeitMin || city?.entfernungKm || '?';

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `Schrank nach Maß bestellen${cityLabel} — Schritt für Schritt`,
    description: `So kommst du in 5 Schritten zu deinem maßgefertigten Schrank von den Schreinerhelden${cityLabel}.`,
    totalTime: 'P8W',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'EUR', value: '2900', minValue: '2400', maxValue: '15000' },
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Online-Planungstermin buchen',
        text: 'Buche dir einen kostenlosen Video-Termin mit Schreinermeister Mario. Geht bequem von überall.',
        url: `${BASE.url}/termin` },
      { '@type': 'HowToStep', position: 2, name: 'Live-Planung mit Festpreis',
        text: 'Mario plant deinen Schrank live im Videocall. Du siehst sofort, wie dein Schrank aussieht — und erfährst deinen verbindlichen Festpreis.' },
      { '@type': 'HowToStep', position: 3, name: `Aufmaß bei dir${cityLabel}`,
        text: `Wir kommen persönlich${city ? ` zu dir nach ${city.name}` : ''} und messen alles millimetergenau.${city ? ` Nur ${fahrzeit} Minuten von unserer Werkstatt.` : ''}` },
      { '@type': 'HowToStep', position: 4, name: 'Fertigung in unserer Werkstatt',
        text: 'Dein Schrank wird individuell in unserer Werkstatt in Murrhardt gefertigt — mit CNC-Präzision und Handwerks-Qualität.' },
      { '@type': 'HowToStep', position: 5, name: 'Lieferung und Montage',
        text: `Wir liefern und montieren deinen Schrank${city ? ` bei dir in ${city.name}` : ' bei dir Zuhause'}. Lieferzeit: 3–8 Wochen ab Auftragseingang.` },
    ],
  };
}

function schemaBreadcrumb(city, pageType) {
  const slug = `schreiner-${city.slug}`;
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Startseite', item: BASE.url },
  ];

  if (pageType === 'ORTS_LP') {
    items.push({ '@type': 'ListItem', position: 2, name: `Schreiner in ${city.name}`, item: `${BASE.url}/${slug}` });
  }

  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

function schemaService(city) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Maßmöbel-Service${city ? ` für ${city.name}` : ''}`,
    description: `Individuelle Einbauschränke und Dachschrägenschränke nach Maß${city ? ` für ${city.name} und Umgebung` : ''}. Aufmaß, Planung, Fertigung und Montage aus einer Hand.`,
    provider: { '@type': 'Organization', '@id': `${BASE.url}/#organization` },
    ...(city ? { areaServed: { '@type': 'City', name: city.name } } : {}),
    serviceType: 'Maßmöbel-Schreinerei',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Maßmöbel-Leistungen',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'Dachschrägenschränke' },
        { '@type': 'OfferCatalog', name: 'Einbauschränke' },
        { '@type': 'OfferCatalog', name: 'Begehbare Kleiderschränke' },
        { '@type': 'OfferCatalog', name: 'Schiebetürenschränke' },
      ],
    },
  };
}

function schemaWebPage(city, meta, pageType) {
  const today = new Date().toISOString().split('T')[0];
  const slug = city ? `schreiner-${city.slug}` : '';

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: meta?.title || `Schreiner in ${city?.name || 'der Region'} — Schreinerhelden`,
    description: meta?.description || `Maßgefertigte Einbauschränke und Dachschrägenschränke${city ? ` in ${city.name}` : ''} von den Schreinerhelden.`,
    url: `${BASE.url}/${slug}`,
    datePublished: today,
    dateModified: today,
    author: { '@type': 'Person', '@id': `${BASE.url}/#mario-esch`, name: MARIO.name },
    publisher: { '@type': 'Organization', '@id': `${BASE.url}/#organization`, name: BASE.companyName,
      logo: { '@type': 'ImageObject', url: BASE.logo } },
    inLanguage: 'de-DE',
    isPartOf: { '@type': 'WebSite', name: 'Schreinerhelden', url: BASE.url },
  };
}


// ─────────────────────────────────────────────
// STANDARD-FAQs (Fallback wenn keine aus Content)
// ─────────────────────────────────────────────

function generateDefaultFAQs(city) {
  const fahrzeit = city?.fahrtzeitMin || city?.entfernungKm || '?';
  const stadtteile = (city?.stadtteile || []).slice(0, 3);
  const stadtteilStr = stadtteile.length > 0
    ? stadtteile.map(st => typeof st === 'string' ? (st.includes(city.name) ? st : `${city.name}-${st}`) : st).join(', ')
    : city?.name || 'der Region';

  return [
    {
      question: `Was kostet ein Dachschrägenschrank nach Maß in ${city.name}?`,
      answer: `Ein maßgefertigter Dachschrägenschrank für Ihr Zuhause in ${city.name} beginnt bei rund 2.900 € brutto für einen 3m breiten Schrank — inklusive Aufmaß vor Ort, Maßanfertigung in unserer Werkstatt in Murrhardt, Lieferung und Montage bei Ihnen. Der genaue Preis hängt von Breite, Ausstattung und Material ab. Im kostenlosen Planungstermin erfahren Sie Ihren verbindlichen Festpreis.`,
    },
    {
      question: `Wie lange dauert die Lieferung nach ${city.name}?`,
      answer: `Die Lieferzeit für Ihren maßgefertigten Schrank beträgt in der Regel 3 bis 8 Wochen ab Auftragseingang. Da ${city.name} nur ${fahrzeit} Minuten von unserer Werkstatt in Murrhardt entfernt liegt, ist die Anlieferung und Montage unkompliziert.`,
    },
    {
      question: `Kommen die Schreinerhelden wirklich bis nach ${city.name}?`,
      answer: `Ja, selbstverständlich! ${city.name} gehört zu unserem Kerngebiet. Von unserer Werkstatt in Murrhardt sind wir in rund ${fahrzeit} Minuten bei Ihnen — egal ob zum Aufmaß oder zur Montage. Wir betreuen regelmäßig Kunden in ${stadtteilStr} und weiteren Stadtteilen.`,
    },
    {
      question: `Welche Schränke fertigen die Schreinerhelden für ${city.name}?`,
      answer: `Wir fertigen alle Arten von Maßmöbeln: Dachschrägenschränke, Einbauschränke, begehbare Kleiderschränke und Schiebetürenschränke. Jeder Schrank wird individuell für Ihre Raumsituation geplant und gefertigt.`,
    },
    {
      question: 'Kann ich meinen Schrank vor der Bestellung sehen?',
      answer: 'Ja! Im kostenlosen Online-Planungstermin plant Schreinermeister Mario Esch Ihren Schrank live mit Ihnen am Bildschirm. Sie sehen sofort, wie Ihr Schrank aussehen wird, und erhalten einen verbindlichen Festpreis. Erst wenn alles passt, geht es weiter zum Aufmaß bei Ihnen vor Ort.',
    },
    {
      question: 'Was passiert, wenn nach der Montage etwas nicht stimmt?',
      answer: 'Dann kommen wir zurück und machen es richtig — ohne Wenn und Aber. Als Meisterbetrieb stehen wir persönlich für unsere Arbeit ein. Jeder Schrank wird millimetergenau gefertigt und von unserem eigenen Team montiert — keine Subunternehmer, keine Ausreden.',
    },
  ];
}


// ─────────────────────────────────────────────
// HAUPT-FUNKTION: generateSchemaStack()
// ─────────────────────────────────────────────

/**
 * Generiert den kompletten Schema.org JSON-LD Stack.
 * Wird aus pipeline.js aufgerufen (ersetzt GPT-4o Schema-Call).
 *
 * @param {Object} options
 * @param {Object} options.city         - city_profiles DB-Row (name, slug, stadtteile, fahrtzeitMin, wikidataId...)
 * @param {string} options.pageType     - 'ORTS_LP' | 'PRODUCT_PAGE' | 'BLOG' | 'PILLAR'
 * @param {string} options.targetProduct - 'Dachschrägenschrank' | 'Einbauschrank' | ...
 * @param {Array}  [options.faqs]       - [{question, answer}] aus dem Content (Fallback: auto-generiert)
 * @param {Object} [options.meta]       - {title, description} für WebPage-Schema
 *
 * @returns {Object} { blocks: Array, htmlScript: string, summary: Object }
 */
function generateSchemaStack(options = {}) {
  const { city, pageType = 'ORTS_LP', targetProduct = 'Dachschrägenschrank', faqs, meta } = options;

  if (!city || !city.name || !city.slug) {
    throw new Error('Schema-Generator: city-Objekt mit name + slug ist Pflicht.');
  }

  const blocks = [];

  // 1. Organization (global)
  blocks.push(schemaOrganization());

  // 2. Person / Mario (global)
  blocks.push(schemaPerson());

  // 3. LocalBusiness (stadt-spezifisch)
  if (pageType === 'ORTS_LP') {
    blocks.push(schemaLocalBusiness(city));
  }

  // 4. Hauptprodukt
  blocks.push(schemaProduct(city, targetProduct));

  // 5. Zweitprodukt (wenn Dachschräge → auch Einbauschrank)
  if (targetProduct === 'Dachschrägenschrank') {
    blocks.push(schemaProduct(city, 'Einbauschrank'));
  } else if (targetProduct === 'Einbauschrank') {
    blocks.push(schemaProduct(city, 'Dachschrägenschrank'));
  }

  // 6. FAQPage (aus Content oder Default)
  const faqData = (faqs && faqs.length > 0) ? faqs : generateDefaultFAQs(city);
  blocks.push(schemaFAQPage(faqData));

  // 7. HowTo
  blocks.push(schemaHowTo(city));

  // 8. Breadcrumb
  blocks.push(schemaBreadcrumb(city, pageType));

  // 9. Service (für AEO/GEO)
  blocks.push(schemaService(city));

  // 10. WebPage (datePublished, dateModified, author — AI-Citation-kritisch)
  blocks.push(schemaWebPage(city, meta, pageType));

  // Fertige HTML <script> Tags — ready for Elementor HTML Widget
  const htmlScript = blocks
    .map(b => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`)
    .join('\n');

  const summary = {
    city: city.name,
    schemaCount: blocks.length,
    types: blocks.map(b => Array.isArray(b['@type']) ? b['@type'].join('+') : b['@type']),
    faqCount: faqData.length,
    hasWebPage: true,
    hasHowTo: true,
    hasService: true,
  };

  return { blocks, htmlScript, summary };
}


module.exports = {
  generateSchemaStack,
  // Einzel-Generatoren für Custom-Use (Product Pages, Blog, etc.)
  schemaOrganization,
  schemaPerson,
  schemaLocalBusiness,
  schemaProduct,
  schemaFAQPage,
  schemaHowTo,
  schemaBreadcrumb,
  schemaService,
  schemaWebPage,
  generateDefaultFAQs,
  // Constants
  BASE,
  MARIO,
  PRODUCTS,
};
