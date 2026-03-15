// ============================================
// MEOS:HELDEN — React Frontend (App.jsx)
// Single-file app for initial deployment
// ============================================

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4200';

// ── Auth Context ──
function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('helden_token'));

  const login = async (email, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('helden_token', data.token);
      setToken(data.token); setUser(data.user);
    }
    return data;
  };

  const logout = () => { localStorage.removeItem('helden_token'); setToken(null); setUser(null); };

  const authFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...opts.headers },
    });
    if (res.status === 401) { logout(); throw new Error('Session abgelaufen'); }
    return res.json();
  }, [token]);

  return { user, token, login, logout, authFetch };
}

// ── Page Types & Cities ──
const PAGE_TYPES = [
  { value: 'ORTS_LP', label: 'Orts-Landingpage', icon: '📍', min: 1500 },
  { value: 'PRODUCT_PAGE', label: 'Produktseite', icon: '🪵', min: 1500 },
  { value: 'BLOG', label: 'Blog-Artikel', icon: '📝', min: 1200 },
  { value: 'PILLAR', label: 'Pillar-Page', icon: '📚', min: 2500 },
];

const PRODUCTS = ['Dachschrägenschrank', 'Begehbarer Kleiderschrank', 'Kleiderschrank', 'Garderobe', 'Stauraumschrank', 'Treppenschrank', 'Waschmaschinenschrank'];

const STATUS_COLORS = {
  INTELLIGENCE: 'bg-blue-100 text-blue-700', STRATEGY: 'bg-blue-100 text-blue-700',
  RETRIEVAL: 'bg-purple-100 text-purple-700', GENERATING: 'bg-yellow-100 text-yellow-700',
  BOARD_REVIEW: 'bg-orange-100 text-orange-700', APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700', EXPORTED: 'bg-emerald-100 text-emerald-700',
  PUBLISHED: 'bg-emerald-200 text-emerald-800',
};

const STATUS_LABELS = {
  INTELLIGENCE: '🔍 Intelligence', STRATEGY: '📋 Strategy', RETRIEVAL: '🧠 RAG',
  GENERATING: '✨ Generierung', BOARD_REVIEW: '🛡️ Board-Review', APPROVED: '✅ Freigegeben',
  REJECTED: '❌ Abgelehnt', EXPORTED: '📦 Exportiert', PUBLISHED: '🌐 Live',
};

export default function App() {
  const { user, token, login, logout, authFetch } = useAuth();
  const [tab, setTab] = useState('pipeline');
  const [stats, setStats] = useState(null);

  // Login
  const [email, setEmail] = useState('mario@schreinerhelden.de');
  const [pw, setPw] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // Pipeline
  const [pageType, setPageType] = useState('ORTS_LP');
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [product, setProduct] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentGen, setCurrentGen] = useState(null);
  const [generations, setGenerations] = useState([]);
  const [selectedGen, setSelectedGen] = useState(null);

  // Cities
  const [cities, setCities] = useState([]);

  useEffect(() => {
    if (token) {
      authFetch('/api/pipeline/stats/overview').then(d => d.success && setStats(d.data)).catch(() => {});
      authFetch('/api/pipeline?limit=50').then(d => d.success && setGenerations(d.data)).catch(() => {});
      authFetch('/api/cities').then(d => d.success && setCities(d.data)).catch(() => {});
    }
  }, [token]);

  // ── LOGIN SCREEN ──
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">🛡️ MEOS:HELDEN</h1>
            <p className="text-gray-500 mt-1">Die Content-Maschine</p>
          </div>
          {loginErr && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{loginErr}</div>}
          <div className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" className="w-full border rounded-lg px-4 py-3" />
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="Passwort" className="w-full border rounded-lg px-4 py-3"
              onKeyDown={e => e.key === 'Enter' && login(email, pw).then(d => !d.success && setLoginErr(d.error))} />
            <button onClick={() => login(email, pw).then(d => !d.success && setLoginErr(d.error))}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg">
              Anmelden
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RUN PIPELINE ──
  async function handleRun() {
    setLoading(true); setCurrentGen(null);
    try {
      const data = await authFetch('/api/pipeline/run-sync', {
        method: 'POST',
        body: JSON.stringify({ pageType, primaryKeyword: keyword, targetCity: city || undefined, targetProduct: product || undefined }),
      });
      if (data.success) {
        setCurrentGen(data.data);
        // Refresh list
        authFetch('/api/pipeline?limit=50').then(d => d.success && setGenerations(d.data));
        authFetch('/api/pipeline/stats/overview').then(d => d.success && setStats(d.data));
      }
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  // ── TABS ──
  const tabs = [
    { id: 'pipeline', label: '🚀 Pipeline', desc: 'Keyword+Ort → Fertige Seite' },
    { id: 'history', label: '📋 Verlauf', desc: 'Alle Generierungen' },
    { id: 'cities', label: '🏙️ Städte', desc: 'Ort-Profile & Priorisierung' },
    { id: 'knowledge', label: '🧠 Wissen', desc: 'RAG Knowledge Base' },
    { id: 'health', label: '🏥 Health', desc: 'Monitoring & Checks' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">🛡️ MEOS:HELDEN</h1>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">v1.0</span>
          </div>
          <div className="flex items-center gap-4">
            {stats && (
              <div className="hidden md:flex gap-3 text-xs">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">🧠 {stats.knowledgeChunks} Chunks</span>
                <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full">📄 {stats.total} Generierungen</span>
                <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full">🏙️ {stats.cities} Städte</span>
              </div>
            )}
            <span className="text-sm text-gray-600">{user?.name || email}</span>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Logout</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg ${
                tab === t.id ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ═══ PIPELINE TAB ═══ */}
        {tab === 'pipeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Input Form */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border p-5 space-y-4">
                <h2 className="font-bold text-lg flex items-center gap-2">🚀 Pipeline starten
                  <span className="text-xs font-normal text-gray-400">6 Stufen → fertige Seite</span>
                </h2>

                {/* Page Type */}
                <div className="grid grid-cols-2 gap-2">
                  {PAGE_TYPES.map(pt => (
                    <button key={pt.value} type="button" onClick={() => setPageType(pt.value)}
                      className={`p-3 rounded-lg border text-left transition ${
                        pageType === pt.value ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-lg">{pt.icon}</span>
                      <span className="ml-1 text-sm font-medium">{pt.label}</span>
                      <span className="block text-xs text-gray-400 mt-0.5">Min. {pt.min}W</span>
                    </button>
                  ))}
                </div>

                {/* Keyword */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Primär-Keyword *</label>
                  <input value={keyword} onChange={e => setKeyword(e.target.value)}
                    placeholder="z.B. einbauschrank stuttgart"
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>

                {/* City */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Stadt</label>
                  <select value={city} onChange={e => setCity(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
                    <option value="">— Stadt wählen —</option>
                    {[1,2,3].map(tier => (
                      <optgroup key={tier} label={`${'⭐'.repeat(Math.max(0,4-tier))} Tier ${tier}`}>
                        {cities.filter(c => c.tier === tier).map(c => (
                          <option key={c.slug} value={c.slug}>{c.name} ({c.einwohner?.toLocaleString()} Einw.)</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Product */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Produkt-Fokus</label>
                  <select value={product} onChange={e => setProduct(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
                    <option value="">— Alle Schranktypen —</option>
                    {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <button onClick={handleRun} disabled={loading || !keyword}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Pipeline läuft... (30-90 Sek.)
                    </span>
                  ) : '🛡️ HELDENFORMEL Pipeline starten'}
                </button>

                <div className="text-xs text-gray-400 text-center">
                  6 Stufen: Intelligence → Strategy → RAG → Generation → Board-Review → Export
                </div>
              </div>

              {/* Pipeline stages indicator */}
              {loading && (
                <div className="bg-white rounded-xl border p-4 space-y-2">
                  {['🔍 Intelligence (DataForSEO + GSC)', '📋 Strategy (Architektur)', '🧠 RAG Retrieval',
                    '✨ Content-Generierung (GPT-4o)', '🛡️ Board-Review (12 Köpfe)', '📦 Export (GenerateBlocks)']
                    .map((stage, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${i < 2 ? 'bg-green-500' : i === 2 ? 'bg-orange-500 animate-pulse' : 'bg-gray-200'}`} />
                      <span className={i <= 2 ? 'text-gray-900' : 'text-gray-400'}>{stage}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Result */}
            <div className="lg:col-span-3 space-y-4">
              {currentGen && (
                <>
                  {/* Status Bar */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[currentGen.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[currentGen.status] || currentGen.status}
                    </span>
                    {currentGen.outputMeta?.wordCount && (
                      <span className="text-sm text-gray-500">📝 {currentGen.outputMeta.wordCount} Wörter</span>
                    )}
                    {currentGen.tokensUsed && (
                      <span className="text-sm text-gray-500">🔤 {currentGen.tokensUsed} Tokens</span>
                    )}
                    {currentGen.durationMs && (
                      <span className="text-sm text-gray-500">⏱️ {(currentGen.durationMs/1000).toFixed(1)}s</span>
                    )}
                    {currentGen.costUsd && (
                      <span className="text-sm text-gray-500">💰 ${currentGen.costUsd.toFixed(3)}</span>
                    )}
                  </div>

                  {/* Board Review */}
                  {currentGen.boardScores && (
                    <div className={`rounded-xl border p-4 ${currentGen.boardPass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <h3 className="font-bold text-sm mb-2">
                        {currentGen.boardPass ? '✅ Board-Review bestanden' : '❌ Board-Review nicht bestanden'}
                        {currentGen.boardScores.passCount !== undefined && (
                          <span className="font-normal text-gray-500 ml-2">
                            {currentGen.boardScores.passCount}/10 Pass · {currentGen.boardScores.warnCount}/10 Warn · {currentGen.boardScores.failCount}/10 Fail
                          </span>
                        )}
                      </h3>
                      {currentGen.boardScores.sandraK !== undefined && (
                        <div className="text-sm">
                          <span className={currentGen.boardScores.sandraK ? 'text-green-700' : 'text-red-700'}>
                            Sandra K.: {currentGen.boardScores.sandraK ? '✅ JA' : '❌ NEIN'}
                          </span>
                          <span className="mx-2">·</span>
                          <span className={currentGen.boardScores.thomasR ? 'text-green-700' : 'text-red-700'}>
                            Thomas R.: {currentGen.boardScores.thomasR ? '✅ JA' : '❌ NEIN'}
                          </span>
                        </div>
                      )}
                      {currentGen.boardScores.raw && (
                        <details className="mt-2"><summary className="text-xs cursor-pointer text-gray-500">Vollständiges Board-Review</summary>
                          <pre className="mt-2 text-xs whitespace-pre-wrap bg-white/50 p-3 rounded">{currentGen.boardScores.raw}</pre>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Meta */}
                  {currentGen.outputMeta && (
                    <div className="bg-gray-50 rounded-xl border p-3 text-sm space-y-1">
                      <div><span className="font-medium">Title:</span> {currentGen.outputMeta.title}</div>
                      <div><span className="font-medium">Description:</span> {currentGen.outputMeta.description}</div>
                    </div>
                  )}

                  {/* Content */}
                  {currentGen.outputContent && (
                    <div className="bg-white rounded-xl border p-5 max-h-[500px] overflow-y-auto">
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap">{currentGen.outputContent}</div>
                    </div>
                  )}

                  {/* Schema */}
                  {currentGen.outputSchema && (
                    <details className="bg-gray-50 rounded-xl border">
                      <summary className="p-3 cursor-pointer font-medium text-sm">
                        📋 Schema.org ({Array.isArray(currentGen.outputSchema) ? currentGen.outputSchema.length : 1} Blöcke)
                      </summary>
                      <pre className="p-4 text-xs overflow-x-auto bg-gray-900 text-green-400 rounded-b-xl">
                        {JSON.stringify(currentGen.outputSchema, null, 2)}
                      </pre>
                    </details>
                  )}

                  {/* Export HTML */}
                  {currentGen.exportHtml && (
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(currentGen.exportHtml)}
                        className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
                        📋 HTML kopieren
                      </button>
                      <button onClick={() => authFetch(`/api/export/wordpress/${currentGen.id}`, { method: 'POST' }).then(d => alert(d.success ? `✅ WordPress Draft erstellt: ${d.wpUrl}` : d.error))}
                        className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">
                        🌐 Nach WordPress pushen (Draft)
                      </button>
                    </div>
                  )}

                  {/* Chunks Used */}
                  {currentGen.chunksUsed?.length > 0 && (
                    <details className="bg-gray-50 rounded-xl border">
                      <summary className="p-3 cursor-pointer text-sm font-medium">🧠 {currentGen.chunksUsed.length} RAG-Chunks genutzt</summary>
                      <div className="p-3 space-y-1">
                        {currentGen.chunksUsed.map((cu, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-white p-2 rounded border">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              cu.selectionReason?.startsWith('mandatory') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                              {cu.chunk?.category || '?'}
                            </span>
                            <span>{cu.chunk?.title || cu.chunkId}</span>
                            {cu.relevanceScore && <span className="ml-auto text-gray-400">{(cu.relevanceScore*100).toFixed(0)}%</span>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}

              {!currentGen && !loading && (
                <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
                  <p className="text-4xl mb-3">🛡️</p>
                  <p className="font-medium">Keyword + Ort eingeben und Pipeline starten</p>
                  <p className="text-sm mt-1">6 Stufen → Board-Review durch 12 Köpfe → Fertige WordPress-Seite</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {tab === 'history' && (
          <div className="space-y-3">
            <h2 className="font-bold text-lg">📋 Generierungs-Verlauf</h2>
            {generations.map(g => (
              <div key={g.id} onClick={() => { setSelectedGen(g); setTab('pipeline'); setCurrentGen(null);
                authFetch(`/api/pipeline/${g.id}`).then(d => d.success && setCurrentGen(d.data)); }}
                className="bg-white rounded-xl border p-4 flex items-center gap-4 cursor-pointer hover:border-orange-300 transition">
                <span className="text-2xl">{PAGE_TYPES.find(pt => pt.value === g.pageType)?.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{g.primaryKeyword}{g.targetCity ? ` — ${g.targetCity}` : ''}</div>
                  <div className="text-xs text-gray-500">{new Date(g.createdAt).toLocaleString('de-DE')} · {g.outputMeta?.wordCount || '?'}W · {g.tokensUsed || '?'} Tokens</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[g.status] || 'bg-gray-100'}`}>
                  {STATUS_LABELS[g.status] || g.status}
                </span>
                {g.boardPass !== null && (
                  <span className="text-lg">{g.boardPass ? '✅' : '❌'}</span>
                )}
              </div>
            ))}
            {generations.length === 0 && <p className="text-gray-400 text-center py-8">Noch keine Generierungen.</p>}
          </div>
        )}

        {/* ═══ CITIES TAB ═══ */}
        {tab === 'cities' && (
          <div>
            <h2 className="font-bold text-lg mb-4">🏙️ Ort-Profile & Priorisierung</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white rounded-xl border">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left p-3">Rang</th><th className="text-left p-3">Stadt</th><th className="p-3">Tier</th>
                    <th className="p-3">Einwohner</th><th className="p-3">Kaufkraft</th><th className="p-3">Fahrtzeit</th>
                    <th className="p-3">Priority</th><th className="p-3">Index-Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c, i) => (
                    <tr key={c.slug} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold text-gray-400">{i + 1}</td>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          c.tier === 1 ? 'bg-green-100 text-green-700' : c.tier === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>
                          Tier {c.tier}
                        </span>
                      </td>
                      <td className="p-3 text-center">{c.einwohner?.toLocaleString()}</td>
                      <td className="p-3 text-center">{c.kaufkraftIndex}</td>
                      <td className="p-3 text-center">{c.fahrtzeitMin} Min</td>
                      <td className="p-3 text-center font-bold">{c.priorityScore?.toFixed(0)}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs ${c.indexStatus === 'indexed' ? 'text-green-600' : 'text-gray-400'}`}>
                          {c.indexStatus === 'indexed' ? '🟢 indexed' : '⚪ noindex'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ KNOWLEDGE TAB ═══ */}
        {tab === 'knowledge' && (
          <div>
            <h2 className="font-bold text-lg mb-4">🧠 RAG Knowledge Base</h2>
            <p className="text-gray-500 text-sm mb-4">
              {stats?.knowledgeChunks || '?'} Chunks in der Wissensbasis. Experten-Prinzipien, Ort-Daten, Bewertungen, Templates, Schema-Vorlagen.
            </p>
            <div className="bg-white rounded-xl border p-6 text-center text-gray-400">
              Knowledge-Manager wird geladen...
              <br/><span className="text-xs">Nutze POST /api/knowledge/batch zum Befüllen via API.</span>
            </div>
          </div>
        )}

        {/* ═══ HEALTH TAB ═══ */}
        {tab === 'health' && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">🏥 Health Checks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => authFetch('/api/health-checks/cta-target', { method: 'POST' }).then(d =>
                alert(d.healthy ? '✅ /termin ist OK' : '⚠️ PROBLEM: ' + (d.hasLoremIpsum ? 'Lorem Ipsum gefunden!' : 'Seite nicht erreichbar'))
              )} className="bg-white rounded-xl border p-6 text-left hover:border-orange-300 transition">
                <h3 className="font-bold">🎯 CTA-Ziel prüfen</h3>
                <p className="text-sm text-gray-500 mt-1">Checkt ob /termin funktioniert und kein Lorem Ipsum enthält</p>
              </button>
              <button onClick={() => authFetch('/api/health-checks/serp-rescan', { method: 'POST' }).then(d =>
                alert(`SERP-Rescan für ${d.results?.length || 0} Seiten abgeschlossen.`)
              )} className="bg-white rounded-xl border p-6 text-left hover:border-orange-300 transition">
                <h3 className="font-bold">📊 SERP-Rescan</h3>
                <p className="text-sm text-gray-500 mt-1">Prüft alle publizierten Seiten gegen aktuelle Google-Rankings</p>
              </button>
              <button onClick={() => authFetch('/api/clusters/check-health', { method: 'POST' }).then(d =>
                alert(d.alerts?.length ? `⚠️ ${d.alerts.length} Cluster-Warnungen` : '✅ Alle Cluster gesund')
              )} className="bg-white rounded-xl border p-6 text-left hover:border-orange-300 transition">
                <h3 className="font-bold">🔗 Cluster Health</h3>
                <p className="text-sm text-gray-500 mt-1">Prüft ob jede Pillar ≥ 3 Cluster-Seiten hat</p>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
