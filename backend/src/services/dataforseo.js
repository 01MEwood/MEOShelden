// ============================================
// MEOS:HELDEN — DataForSEO Service
// Uses existing MEOS:SEO DataForSEO credentials
// ============================================

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const BASE = 'https://api.dataforseo.com';

async function dfsRequest(endpoint, body) {
  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${await res.text()}`);
  return res.json();
}

// SERP Analysis
async function fetchSERP(query, locationCode = '1003854') {
  const data = await dfsRequest('/v3/serp/google/organic/live/advanced', [{
    keyword: query,
    location_code: parseInt(locationCode),
    language_code: 'de',
    device: 'desktop',
    os: 'windows',
  }]);

  const items = data?.tasks?.[0]?.result?.[0]?.items || [];
  return {
    items: items.map(item => ({
      type: item.type,
      position: item.rank_absolute,
      title: item.title,
      url: item.url,
      description: item.description,
      domain: item.domain,
    })),
    totalResults: data?.tasks?.[0]?.result?.[0]?.se_results_count,
    featuredSnippet: items.some(i => i.type === 'featured_snippet'),
    peopleAlsoAsk: items.filter(i => i.type === 'people_also_ask').map(i => i.title),
    localPack: items.some(i => i.type === 'local_pack'),
  };
}

// Keyword Volumes
async function fetchKeywordVolumes(keywords, locationCode = '1003854') {
  const data = await dfsRequest('/v3/keywords_data/google_ads/search_volume/live', [{
    keywords,
    location_code: parseInt(locationCode),
    language_code: 'de',
  }]);

  const results = data?.tasks?.[0]?.result || [];
  return results.map(r => ({
    keyword: r.keyword,
    volume: r.search_volume,
    competition: r.competition,
    competitionIndex: r.competition_index,
    cpc: r.cpc,
    trend: r.monthly_searches?.slice(0, 6),
  })).sort((a, b) => (b.volume || 0) - (a.volume || 0));
}

// OnPage Analysis (for competitor scanning)
async function fetchOnPage(url) {
  try {
    const data = await dfsRequest('/v3/on_page/instant_pages', [{
      url,
      load_resources: false,
      enable_javascript: false,
    }]);

    const page = data?.tasks?.[0]?.result?.[0]?.items?.[0];
    if (!page) return { url, wordCount: 0, hasSchema: false };

    return {
      url,
      title: page.meta?.title,
      wordCount: page.meta?.content?.plain_text_word_count || 0,
      h1: page.meta?.htags?.h1?.[0],
      h2Count: page.meta?.htags?.h2?.length || 0,
      hasSchema: (page.meta?.scripts?.count || 0) > 0,
      pageSize: page.page_timing?.download_time ? Math.round(page.resource_errors?.length || 0) : 0,
      statusCode: page.status_code,
      content: page.meta?.content?.plain_text_content?.slice(0, 2000),
    };
  } catch (e) {
    console.error(`OnPage failed for ${url}:`, e.message);
    return { url, wordCount: 0, hasSchema: false, error: e.message };
  }
}

module.exports = { fetchSERP, fetchKeywordVolumes, fetchOnPage };
