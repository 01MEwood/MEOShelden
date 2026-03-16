// ============================================
// MEOS:HELDEN — City Profile Seed (Raw SQL)
// Run: node seeds/seed-cities.js
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
if (!process.env.DATABASE_URL) require('dotenv').config();
const { pool, query, queryOne } = require('../backend/src/db');

const cities = [
  // ── TIER 1 ──
  { name: 'Stuttgart', slug: 'stuttgart', tier: 1, einwohner: 626275, kaufkraftIndex: 112.3,
    entfernungKm: 45, fahrtzeitMin: 40, priorityScore: 95, geoCode: '1004271', wikidataId: 'Q1022',
    stadtteile: ['West','Süd','Degerloch','Vaihingen','Killesberg','Botnang','Sillenbuch','Möhringen','Bad Cannstatt','Feuerbach'],
    wohntypen: ['Altbau','Gründerzeit','Penthouse','Reihenhaus','Neubau'],
    painPoints: ['Altbau-Dachschrägen mit schiefen Winkeln','Enge Gründerzeit-Flure','Hohe Decken ohne Nutzung','Parkprobleme bei Montage'],
    lokalkolorit: 'In der Landeshauptstadt weiß man, was gute Handwerksarbeit wert isch. Ob Halbhöhenlage oder Talkessel — wir kennen die Stuttgarter Raumsituationen.',
    uniqueValueAdd: 'Stadtteil-Stauraum-Guide: Welcher Schranktyp passt zu welchem Stuttgarter Quartier (Altbau-West vs. Neubau-Killesberg)',
    localBacklinks: ['stuttgart.de','stuttgarter-zeitung.de','stuttgarter-nachrichten.de','handwerkskammer-stuttgart.de'] },

  { name: 'Ludwigsburg', slug: 'ludwigsburg', tier: 1, einwohner: 93584, kaufkraftIndex: 109.1,
    entfernungKm: 50, fahrtzeitMin: 45, priorityScore: 82, geoCode: '1004271',
    stadtteile: ['Innenstadt','Eglosheim','Pflugfelden','Oßweil','Grünbühl','Poppenweiler'],
    wohntypen: ['Barockstadt-Altbau','Neubau','Reihenhaus','Etagenwohnung'],
    painPoints: ['Barocke Raumschnitte mit krummen Wänden','Denkmalschutz-Auflagen','Kleine Schlafzimmer in Neubauten'],
    lokalkolorit: 'Vom Schloss inspiriert, vom Handwerk geprägt — in Ludwigsburg schätzt man Qualität mit Tradition.',
    uniqueValueAdd: 'Barockstadt-Special: Wie man in denkmalgeschützten Altbauten maximalen Stauraum schafft ohne die Bausubstanz zu verändern',
    localBacklinks: ['ludwigsburg.de','lkz.de','handwerkskammer-stuttgart.de'] },

  { name: 'Heilbronn', slug: 'heilbronn', tier: 1, einwohner: 128334, kaufkraftIndex: 101.2,
    entfernungKm: 35, fahrtzeitMin: 35, priorityScore: 78, geoCode: '1004271',
    stadtteile: ['Innenstadt','Böckingen','Sontheim','Neckargartach','Frankenbach','Klingenberg'],
    wohntypen: ['Neubau (Neckarbogen)','Reihenhaus','Bestandsimmobilie','Bauträger-Standard'],
    painPoints: ['Neubau mit kleinen Räumen','Bauträger-Standard reicht nicht','Familien brauchen mehr Stauraum'],
    lokalkolorit: 'In Heilbronn packt man an — und genau das tun wir auch. Vom Aufmaß bis zur Montage, bodenständig und zuverlässig.',
    uniqueValueAdd: 'Neckarbogen-Neubau-Guide: Clevere Stauraumlösungen für die modernen Grundrisse im neuen Stadtquartier',
    localBacklinks: ['heilbronn.de','stimme.de','handwerkskammer-heilbronn.de'] },

  { name: 'Waiblingen', slug: 'waiblingen', tier: 1, einwohner: 55449, kaufkraftIndex: 108.4,
    entfernungKm: 30, fahrtzeitMin: 30, priorityScore: 74, geoCode: '1004271',
    stadtteile: ['Altstadt','Hohenacker','Hegnach','Bittenfeld','Beinstein','Neustadt'],
    wohntypen: ['Fachwerk-Altstadt','Einfamilienhaus','Neubau-Wohnung'],
    painPoints: ['Fachwerk = schiefe Wände','Dachgeschosse in Altbauten','Teilorte mit individuellen Grundrissen'],
    lokalkolorit: 'Als Rems-Murr-Nachbarn kennen wir Waiblingen wie unsere Werkstatt — persönlich und auf kurzen Wegen.',
    uniqueValueAdd: 'Rems-Murr-Nachbarschafts-Vorteil: Aufmaß am selben Tag, kürzeste Lieferwege der Region',
    localBacklinks: ['waiblingen.de','zvw.de'] },

  { name: 'Backnang', slug: 'backnang', tier: 1, einwohner: 37581, kaufkraftIndex: 102.3,
    entfernungKm: 15, fahrtzeitMin: 15, priorityScore: 63, geoCode: '1004271',
    stadtteile: ['Innenstadt','Maubach','Steinbach','Waldrems','Sachsenweiler'],
    wohntypen: ['Bestandsimmobilie','Fachwerk','Einfamilienhaus'],
    painPoints: ['Bestandsimmobilien mit ungünstiger Raumaufteilung','Dachgeschoss-Ausbau als Trend','Alte Schränke raus, neue Maßlösung rein'],
    lokalkolorit: 'Von Murrhardt nach Backnang — das sind 15 Minuten. Näher geht Schreinerei nicht.',
    uniqueValueAdd: '15-Minuten-Versprechen: Vom Aufmaß-Anruf bis zur Haustür in einer Viertelstunde',
    localBacklinks: ['backnang.de','bkz.de'] },

  // ── TIER 2 ──
  { name: 'Schwäbisch Hall', slug: 'schwaebisch-hall', tier: 2, einwohner: 41353, kaufkraftIndex: 99.1,
    entfernungKm: 40, fahrtzeitMin: 40, priorityScore: 58,
    stadtteile: ['Altstadt','Hessental','Sulzdorf','Bibersfeld'],
    wohntypen: ['Fachwerk-Altstadt','Einfamilienhaus','Neubaugebiet'],
    painPoints: ['Fachwerk-Altstadt mit extremen Schieflagen','Historische Gebäude','Enge Treppenhäuser'],
    lokalkolorit: 'In einer Stadt, die das Handwerk im Namen trägt, fühlen wir uns besonders zuhause.',
    uniqueValueAdd: 'Mario unterrichtet an der Meisterschule in Schwäbisch Hall — hier kennt man seinen Namen und seine Qualität persönlich',
    localBacklinks: ['schwaebischhall.de','swp.de'] },

  { name: 'Schwäbisch Gmünd', slug: 'schwaebisch-gmuend', tier: 2, einwohner: 61186, kaufkraftIndex: 96.8,
    entfernungKm: 45, fahrtzeitMin: 45, priorityScore: 65,
    stadtteile: ['Innenstadt','Bettringen','Straßdorf','Bargau','Hussenhofen'],
    wohntypen: ['Altbau','Reihenhaus','Neubaugebiet'],
    painPoints: ['Altbau-Sanierungen','Familienhäuser mit wachsendem Platzbedarf'],
    lokalkolorit: 'Gmünd ist Goldstadt und Stauferstadt — hier versteht man den Wert von Handarbeit und Präzision.',
    localBacklinks: ['schwaebisch-gmuend.de','remszeitung.de'] },

  { name: 'Winnenden', slug: 'winnenden', tier: 2, einwohner: 28557, kaufkraftIndex: 105.2,
    entfernungKm: 20, fahrtzeitMin: 20, priorityScore: 52,
    stadtteile: ['Innenstadt','Bürg','Hertmannsweiler','Breuningsweiler'],
    wohntypen: ['Einfamilienhaus','Reihenhaus','Neubau'],
    painPoints: ['Wachsende Familien brauchen mehr Stauraum','Dachgeschoss-Ausbau'],
    lokalkolorit: 'Zwischen Weinbergen und Werkstatt — Winnenden ist nur 20 Minuten entfernt.',
    localBacklinks: ['winnenden.de'] },

  { name: 'Welzheim', slug: 'welzheim', tier: 2, einwohner: 11234, kaufkraftIndex: 101.5,
    entfernungKm: 10, fahrtzeitMin: 10, priorityScore: 30,
    stadtteile: ['Kernstadt','Breitenfürst','Aichstrut'],
    wohntypen: ['Einfamilienhaus','Bauernhaus','Neubau'],
    painPoints: ['Ländliche Grundrisse mit viel ungenutztem Dachboden'],
    lokalkolorit: 'Welzheim liegt praktisch um die Ecke — Schwäbischer Wald unter Nachbarn.',
    localBacklinks: ['welzheim.de'] },

  { name: 'Aalen', slug: 'aalen', tier: 2, einwohner: 68456, kaufkraftIndex: 98.5,
    entfernungKm: 60, fahrtzeitMin: 55, priorityScore: 62,
    stadtteile: ['Innenstadt','Wasseralfingen','Unterkochen','Ebnat','Dewangen'],
    wohntypen: ['Einfamilienhaus','Reihenhaus','Altbau-Wohnung'],
    painPoints: ['Große Häuser mit ineffizienter Raumnutzung','Keller/Dachboden-Ausbau'],
    lokalkolorit: 'Vom Schwäbischen Wald an die Ostalb — auch in Aalen fertigen wir deinen Schrank nach Maß.',
    localBacklinks: ['aalen.de','schwaebische.de'] },

  { name: 'Esslingen', slug: 'esslingen', tier: 2, einwohner: 94057, kaufkraftIndex: 107.5,
    entfernungKm: 50, fahrtzeitMin: 45, priorityScore: 76,
    stadtteile: ['Altstadt','Berkheim','Zell','Mettingen','Weil','Oberesslingen'],
    wohntypen: ['Fachwerk-Altstadt','Einfamilienhaus','Neubau'],
    painPoints: ['Fachwerk = schiefste Wände Süddeutschlands','Enge Altstadtgassen = Lieferung planen'],
    lokalkolorit: 'In einer Stadt voller Fachwerk wissen wir, was schiefe Wände bedeuten — und wie man daraus perfekten Stauraum macht.',
    uniqueValueAdd: 'Fachwerk-Experten: Warum Einbauschränke in Esslinger Fachwerkhäusern besondere Planung brauchen',
    localBacklinks: ['esslingen.de','esslinger-zeitung.de'] },

  { name: 'Öhringen', slug: 'oehringen', tier: 2, einwohner: 24835, kaufkraftIndex: 97.6,
    entfernungKm: 35, fahrtzeitMin: 35, priorityScore: 42,
    stadtteile: ['Innenstadt','Ohrnberg','Cappel','Michelbach'],
    wohntypen: ['Einfamilienhaus','Bauernhaus','Neubaugebiet'],
    painPoints: ['Ländliche Grundrisse','Große Häuser mit wenig Schranksystem'],
    lokalkolorit: 'Im Hohenlohekreis verbindet sich Landleben mit Qualitätsanspruch — genau wie bei uns.',
    localBacklinks: ['oehringen.de','hohenloher-zeitung.de'] },

  // ── TIER 3 ──
  { name: 'Fellbach', slug: 'fellbach', tier: 3, einwohner: 45671, kaufkraftIndex: 110.8,
    entfernungKm: 35, fahrtzeitMin: 35, priorityScore: 57,
    stadtteile: ['Fellbach','Schmiden','Oeffingen'],
    wohntypen: ['Reihenhaus','Etagenwohnung','Villa'],
    painPoints: ['Hohe Kaufkraft aber Standard-Möbel passen nicht zum Anspruch'],
    lokalkolorit: 'Fellbach — Weinstadt vor den Toren Stuttgarts. Hier schätzt man das Besondere.',
    localBacklinks: ['fellbach.de'] },

  { name: 'Crailsheim', slug: 'crailsheim', tier: 3, einwohner: 35213, kaufkraftIndex: 95.4,
    entfernungKm: 70, fahrtzeitMin: 60, priorityScore: 40,
    stadtteile: ['Innenstadt','Altenmünster','Jagstheim','Roßfeld'],
    wohntypen: ['Einfamilienhaus','Bestandsimmobilie'],
    painPoints: ['Weite Anfahrt = Planung muss beim ersten Mal sitzen'],
    lokalkolorit: 'Auch bis nach Crailsheim kommen wir — denn gutes Handwerk kennt keine Entfernungsgrenzen.',
    localBacklinks: ['crailsheim.de','hohenloher-tagblatt.de'] },

  { name: 'Ellwangen', slug: 'ellwangen', tier: 3, einwohner: 25112, kaufkraftIndex: 96.1,
    entfernungKm: 65, fahrtzeitMin: 55, priorityScore: 35,
    stadtteile: ['Innenstadt','Pfahlheim','Rindelbach'],
    wohntypen: ['Einfamilienhaus','Altbau'],
    painPoints: ['Ländliche Grundrisse mit Dachschrägen'],
    lokalkolorit: 'Zwischen Jagst und Schwäbischer Alb — Ellwangen verdient Schreinerqualität aus Murrhardt.',
    localBacklinks: ['ellwangen.de'] },

  { name: 'Schorndorf', slug: 'schorndorf', tier: 3, einwohner: 39824, kaufkraftIndex: 104.1,
    entfernungKm: 25, fahrtzeitMin: 25, priorityScore: 50,
    stadtteile: ['Innenstadt','Haubersbronn','Schornbach','Miedelsbach'],
    wohntypen: ['Fachwerk','Reihenhaus','Neubau'],
    painPoints: ['Daimler-Stadt mit qualitätsbewussten Kunden','Fachwerk-Herausforderungen'],
    lokalkolorit: 'Die Daimler-Stadt kennt Präzision — und genau die liefern wir, 25 Minuten entfernt.',
    localBacklinks: ['schorndorf.de','zvw.de'] },

  { name: 'Kornwestheim', slug: 'kornwestheim', tier: 3, einwohner: 34213, kaufkraftIndex: 103.7,
    entfernungKm: 50, fahrtzeitMin: 45, priorityScore: 48,
    stadtteile: ['Innenstadt','Pattonville'],
    wohntypen: ['Etagenwohnung','Reihenhaus','Neubau Pattonville'],
    painPoints: ['Neubaugebiet Pattonville = viele junge Familien mit Einrichtungsbedarf'],
    lokalkolorit: 'Kornwestheim wächst — und mit ihm der Bedarf an cleverem Stauraum.',
    localBacklinks: ['kornwestheim.de'] },

  { name: 'Böblingen', slug: 'boeblingen', tier: 3, einwohner: 51204, kaufkraftIndex: 111.7,
    entfernungKm: 55, fahrtzeitMin: 50, priorityScore: 72,
    stadtteile: ['Innenstadt','Dagersheim','Schönaich (Umland)'],
    wohntypen: ['Reihenhaus','Einfamilienhaus','Neubau'],
    painPoints: ['IBM/HP-Stadt = internationales Publikum mit hohem Anspruch','Kaufkraft über Durchschnitt'],
    lokalkolorit: 'Böblingen verbindet Tech-Innovation mit schwäbischer Lebensart — genau wie wir.',
    uniqueValueAdd: 'Tech-Meets-Handwerk: Warum IT-Profis in Böblingen auf Schreinerqualität statt Konfigurator setzen',
    localBacklinks: ['boeblingen.de','krzbb.de'] },
];

async function seed() {
  console.log(`🏙️ Seeding ${cities.length} city profiles...`);

  for (const c of cities) {
    await query(
      `INSERT INTO city_profiles (id, name, slug, tier, einwohner, "kaufkraftIndex", "entfernungKm", "fahrtzeitMin", "priorityScore", "geoCode", "wikidataId", stadtteile, wohntypen, "painPoints", lokalkolorit, "uniqueValueAdd", "localBacklinks", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4()::text, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, NOW(), NOW())
       ON CONFLICT (slug) DO UPDATE SET
         name=$1, tier=$3, einwohner=$4, "kaufkraftIndex"=$5, "entfernungKm"=$6, "fahrtzeitMin"=$7,
         "priorityScore"=$8, "geoCode"=$9, "wikidataId"=$10, stadtteile=$11, wohntypen=$12,
         "painPoints"=$13, lokalkolorit=$14, "uniqueValueAdd"=$15, "localBacklinks"=$16, "updatedAt"=NOW()`,
      [c.name, c.slug, c.tier, c.einwohner, c.kaufkraftIndex, c.entfernungKm, c.fahrtzeitMin,
       c.priorityScore, c.geoCode || null, c.wikidataId || null, c.stadtteile || [], c.wohntypen || [],
       c.painPoints || [], c.lokalkolorit || null, c.uniqueValueAdd || null, c.localBacklinks || []]
    );
    console.log(`  ✅ ${c.name} (Tier ${c.tier}, Priority ${c.priorityScore})`);
  }

  console.log(`\n🎉 ${cities.length} City Profiles ready!`);

  // Seed initial cluster map
  const clusterSeeds = [
    { pillarSlug: '/schrank-nach-mass-ratgeber', pillarTitle: 'Schrank nach Maß — Kompletter Ratgeber' },
    { pillarSlug: '/was-kostet-ein-einbauschrank', pillarTitle: 'Was kostet ein Einbauschrank?' },
    { pillarSlug: '/schreiner-vs-konfigurator', pillarTitle: 'Schreiner vs. Online-Konfigurator' },
  ];

  for (const cl of clusterSeeds) {
    await query(
      `INSERT INTO cluster_map (id, "pillarSlug", "pillarTitle", "clusterSlugs", "healthScore", "createdAt", "updatedAt")
       VALUES (uuid_generate_v4()::text, $1, $2, '{}', 0, NOW(), NOW())
       ON CONFLICT ("pillarSlug") DO UPDATE SET "pillarTitle"=$2, "updatedAt"=NOW()`,
      [cl.pillarSlug, cl.pillarTitle]
    );
    console.log(`  📂 Pillar: ${cl.pillarTitle}`);
  }

  console.log('\n✅ Cluster map initialized!');
}

seed().catch(console.error).finally(() => pool.end());
