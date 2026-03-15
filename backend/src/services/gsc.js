// ============================================
// MEOS:HELDEN — Google Search Console Service
// Reads GSC data via API (reuses MEOS:SEO auth)
// ============================================

const { google } = require('googleapis');

let authClient = null;

async function getAuthClient() {
  if (authClient) return authClient;
  
  // Use service account or OAuth from MEOS:SEO
  const credentials = process.env.GSC_CREDENTIALS ? JSON.parse(process.env.GSC_CREDENTIALS) : null;
  
  if (!credentials) {
    console.warn('GSC: No credentials configured. GSC data will be skipped.');
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  authClient = await auth.getClient();
  return authClient;
}

async function fetchGSCData(keyword, cityName) {
  const auth = await getAuthClient();
  if (!auth) return null;

  const webmasters = google.searchconsole({ version: 'v1', auth });
  const siteUrl = process.env.GSC_SITE_URL || 'https://schreinerhelden.de/';

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const queryFilter = [keyword, cityName].filter(Boolean).join(' ');

  try {
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'query',
            operator: 'contains',
            expression: queryFilter,
          }]
        }],
        rowLimit: 25,
      }
    });

    const rows = response.data.rows || [];
    return {
      queries: rows.map(r => ({
        query: r.keys[0],
        page: r.keys[1],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })),
      totalClicks: rows.reduce((s, r) => s + r.clicks, 0),
      totalImpressions: rows.reduce((s, r) => s + r.impressions, 0),
      avgPosition: rows.length > 0
        ? rows.reduce((s, r) => s + r.position, 0) / rows.length
        : null,
      bestPosition: rows.length > 0
        ? Math.min(...rows.map(r => r.position))
        : null,
    };
  } catch (e) {
    console.error('GSC query failed:', e.message);
    return null;
  }
}

module.exports = { fetchGSCData };
