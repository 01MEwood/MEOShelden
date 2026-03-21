// ============================================
// MEOS:HELDEN — React Frontend (App.jsx)
// Single-file app for initial deployment
// ============================================

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

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

// ── Social Content Tab ──
function SocialTab({ authFetch }) {
  const [generations, setGenerations] = useState([]);
  const [selectedGen, setSelectedGen] = useState(null);
  const [social, setSocial] = useState({});
  const [generating, setGenerating] = useState(false);
  const [genChannel, setGenChannel] = useState(null);

  async function loadGenerations() {
    const d = await authFetch('/api/pipeline?limit=20&status=APPROVED,EXPORTED,PUBLISHED,REJECTED');
    if (d.data) setGenerations(d.data.filter(g => g.outputContent));
  }

  async function loadSocial(genId) {
    const d = await authFetch(`/api/social/content/${genId}`);
    if (d.success) setSocial(d.social || {});
  }

  async function selectGen(gen) {
    setSelectedGen(gen);
    setSocial({});
    await loadSocial(gen.id);
  }

  async function generateChannel(channel) {
    if (!selectedGen) return;
    setGenChannel(channel); setGenerating(true);
    try {
      const d = await authFetch(`/api/social/generate/${selectedGen.id}`, {
        method: 'POST', body: JSON.stringify({ channel }),
      });
      if (d.success) {
        setSocial(prev => ({ ...prev, [channel]: { content: d.content, parsed: d.parsed, createdAt: new Date().toISOString() } }));
      } else alert(d.error);
    } catch (e) { alert(e.message); }
    setGenerating(false); setGenChannel(null);
  }

  async function generateAll() {
    if (!selectedGen) return;
    setGenerating(true); setGenChannel('all');
    try {
      const d = await authFetch(`/api/social/bulk/${selectedGen.id}`, { method: 'POST' });
      if (d.success) {
        const newSocial = {};
        for (const [ch, data] of Object.entries(d.results)) {
          newSocial[ch] = { content: data.raw, parsed: data.parsed, createdAt: new Date().toISOString() };
        }
        setSocial(newSocial);
      } else alert(d.error);
    } catch (e) { alert(e.message); }
    setGenerating(false); setGenChannel(null);
  }

  useEffect(() => { loadGenerations(); }, []);

  const CHANNELS = [
    { id: 'gbp', name: 'Google Business', icon: '📍', color: 'blue' },
    { id: 'instagram', name: 'Instagram / Facebook', icon: '📸', color: 'pink' },
    { id: 'pinterest', name: 'Pinterest', icon: '📌', color: 'red' },
    { id: 'blog', name: 'Blog-Artikel', icon: '📝', color: 'green' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">📢 Social Content Multiplier</h2>
        {selectedGen && (
          <button onClick={generateAll} disabled={generating}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg">
            {generating && genChannel === 'all' ? '⏳ Generiert alle...' : '🚀 Alle 4 Kanäle generieren'}
          </button>
        )}
      </div>

      {/* Generation Picker */}
      <div className="bg-white rounded-xl border p-4">
        <label className="text-sm font-medium text-gray-700">Landingpage auswählen:</label>
        <select onChange={e => { const g = generations.find(g => g.id === e.target.value); if (g) selectGen(g); }}
          value={selectedGen?.id || ''} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm">
          <option value="">— Generierung wählen —</option>
          {generations.map(g => (
            <option key={g.id} value={g.id}>
              {g.targetCity ? `${g.targetCity} — ` : ''}{g.primaryKeyword} ({g.outputMeta?.wordCount || '?'}W, {new Date(g.createdAt).toLocaleDateString('de-DE')})
            </option>
          ))}
        </select>
      </div>

      {!selectedGen && (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📢</p>
          <p className="font-medium">Wähle eine Landingpage aus dem Dropdown</p>
          <p className="text-sm mt-1">Dann generiere Social Content für alle 4 Kanäle auf einmal</p>
        </div>
      )}

      {/* Channel Cards */}
      {selectedGen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHANNELS.map(ch => {
            const data = social[ch.id];
            const isGenerating = generating && (genChannel === ch.id || genChannel === 'all');
            return (
              <div key={ch.id} className="bg-white rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                  <span className="font-bold text-sm">{ch.icon} {ch.name}</span>
                  <div className="flex gap-1">
                    {data && (
                      <button onClick={() => navigator.clipboard.writeText(data.content || '').then(() => alert('Kopiert!'))}
                        className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">📋</button>
                    )}
                    <button onClick={() => generateChannel(ch.id)} disabled={isGenerating}
                      className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 disabled:opacity-50">
                      {isGenerating ? '⏳' : '🔄'} {isGenerating ? 'Läuft...' : data ? 'Neu' : 'Generieren'}
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  {isGenerating && !data && (
                    <div className="text-center py-8 text-gray-400">
                      <div className="animate-pulse text-2xl mb-2">⏳</div>
                      <p className="text-sm">Generiert {ch.name}...</p>
                    </div>
                  )}
                  {data ? (
                    <div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto font-sans leading-relaxed">{data.content}</pre>
                      {data.parsed && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer">Strukturierte Daten</summary>
                          <pre className="text-xs bg-gray-50 p-2 mt-1 rounded overflow-auto max-h-32">{JSON.stringify(data.parsed, null, 2)}</pre>
                        </details>
                      )}
                      <div className="text-xs text-gray-300 mt-2">{data.createdAt ? new Date(data.createdAt).toLocaleString('de-DE') : ''}</div>
                    </div>
                  ) : !isGenerating && (
                    <div className="text-center py-6 text-gray-300">
                      <p className="text-sm">Noch nicht generiert</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Users Management Tab ──
function UsersTab({ authFetch, currentUser }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'team' });

  async function loadUsers() {
    const d = await authFetch('/api/auth/users');
    if (d.success) setUsers(d.users);
  }

  useEffect(() => { loadUsers(); }, []);

  function resetForm() { setForm({ name: '', email: '', password: '', role: 'team' }); setShowForm(false); setEditId(null); }

  async function handleSubmit() {
    if (!form.name || !form.email) return alert('Name und Email sind Pflicht.');
    if (!editId && !form.password) return alert('Passwort ist Pflicht für neue Benutzer.');

    if (editId) {
      const body = { name: form.name, role: form.role };
      if (form.password) body.password = form.password;
      const d = await authFetch(`/api/auth/users/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      if (d.success) { resetForm(); loadUsers(); } else alert(d.error);
    } else {
      const d = await authFetch('/api/auth/users', { method: 'POST', body: JSON.stringify(form) });
      if (d.success) { resetForm(); loadUsers(); } else alert(d.error);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`"${name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    const d = await authFetch(`/api/auth/users/${id}`, { method: 'DELETE' });
    if (d.success) loadUsers(); else alert(d.error);
  }

  function startEdit(u) {
    setEditId(u.id);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setShowForm(true);
  }

  const ROLE_LABELS = { admin: '🔑 Admin', team: '👤 Team', viewer: '👁️ Viewer' };
  const ROLE_COLORS = { admin: 'bg-orange-100 text-orange-700', team: 'bg-blue-100 text-blue-700', viewer: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">👥 Benutzer verwalten</h2>
        {currentUser?.role === 'admin' && (
          <button onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg">
            {showForm ? '✕ Abbrechen' : '＋ Neuer Benutzer'}
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-bold text-sm">{editId ? '✏️ Benutzer bearbeiten' : '＋ Neuen Benutzer anlegen'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Mario Esch" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Email *</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                placeholder="mario@schreinerhelden.de" disabled={!!editId}
                className={`w-full border rounded-lg px-3 py-2 text-sm mt-1 ${editId ? 'bg-gray-50' : ''}`} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Passwort {editId ? '(leer = unverändert)' : '*'}</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                placeholder={editId ? '••••••••' : 'Passwort vergeben'}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Rolle</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                <option value="admin">🔑 Admin — Volle Rechte</option>
                <option value="team">👤 Team — Pipeline + Export</option>
                <option value="viewer">👁️ Viewer — Nur lesen</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
              {editId ? '💾 Speichern' : '＋ Anlegen'}
            </button>
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Abbrechen</button>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-400">
              {u.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm flex items-center gap-2">
                {u.name}
                {u.id === currentUser?.id && <span className="text-xs text-gray-400">(Du)</span>}
              </div>
              <div className="text-xs text-gray-400">{u.email}</div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || ROLE_COLORS.viewer}`}>
              {ROLE_LABELS[u.role] || u.role}
            </span>
            <div className="text-xs text-gray-300">
              {u.createdAt ? new Date(u.createdAt).toLocaleDateString('de-DE') : ''}
            </div>
            {currentUser?.role === 'admin' && (
              <div className="flex gap-1">
                <button onClick={() => startEdit(u)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-sm" title="Bearbeiten">✏️</button>
                {u.id !== currentUser?.id && (
                  <button onClick={() => handleDelete(u.id, u.name)}
                    className="p-2 hover:bg-red-50 rounded-lg text-sm" title="Löschen">🗑️</button>
                )}
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            <p className="text-2xl mb-2">👥</p>
            <p className="text-sm">Keine Benutzer gefunden.</p>
          </div>
        )}
      </div>

      {/* Role explanation */}
      <div className="bg-gray-50 rounded-xl border p-4">
        <h3 className="text-sm font-bold text-gray-500 mb-2">Rollen-Übersicht</h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><span className="font-bold text-orange-600">🔑 Admin</span><br/>Alles: Pipeline, Export, WordPress-Push, Benutzer verwalten, Knowledge bearbeiten</div>
          <div><span className="font-bold text-blue-600">👤 Team</span><br/>Pipeline starten, Export, WordPress-Push, Knowledge lesen</div>
          <div><span className="font-bold text-gray-500">👁️ Viewer</span><br/>Nur lesen: Verlauf ansehen, Städte-Status prüfen</div>
        </div>
      </div>
    </div>
  );
}

// ── WordPress Batch Tab ──
function WordPressTab({ authFetch, cities }) {
  const [wpStatus, setWpStatus] = useState(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');
  const [selectedTier, setSelectedTier] = useState('');

  async function loadStatus() {
    const d = await authFetch('/api/export/wordpress-status');
    if (d.success) setWpStatus(d);
  }

  useEffect(() => { loadStatus(); }, []);

  async function runBatch() {
    if (!confirm(`Batch starten: ${selectedTier ? `Tier ${selectedTier}` : 'ALLE 18'} Städte generieren + als Elementor-Draft nach WordPress pushen?\n\nDas dauert ca. ${selectedTier ? '5-10' : '20-40'} Minuten.`)) return;
    setBatchRunning(true); setBatchMsg('');
    try {
      const body = selectedTier ? { tier: parseInt(selectedTier) } : {};
      const d = await authFetch('/api/export/wordpress-batch', { method: 'POST', body: JSON.stringify(body) });
      setBatchMsg(d.message || 'Batch gestartet...');
      // Poll status every 30s
      const poll = setInterval(async () => {
        await loadStatus();
      }, 30000);
      // Stop polling after 45 min
      setTimeout(() => { clearInterval(poll); setBatchRunning(false); loadStatus(); }, 2700000);
    } catch (e) { setBatchMsg('Fehler: ' + e.message); setBatchRunning(false); }
  }

  async function pushSingle(slug) {
    if (!confirm(`${slug} generieren + nach WordPress pushen?`)) return;
    setBatchMsg(`⏳ ${slug} wird generiert...`);
    try {
      const d = await authFetch('/api/export/wordpress-city', {
        method: 'POST', body: JSON.stringify({ citySlug: slug }),
      });
      setBatchMsg(d.success ? `✅ ${d.city}: Draft erstellt (${d.wordCount} Wörter)` : `❌ ${d.error}`);
      await loadStatus();
    } catch (e) { setBatchMsg('Fehler: ' + e.message); }
  }

  const STATUS_ICON = {
    'PUBLISHED': '🟢', 'EXPORTED': '🟡', 'APPROVED': '🟡',
    'REJECTED': '🔴', 'NICHT GENERIERT': '⚪',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">🌐 WordPress Batch-Push</h2>
        <div className="flex items-center gap-2">
          <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Alle 18 Städte</option>
            <option value="1">Tier 1 ({cities.filter(c => c.tier === 1).length} Städte)</option>
            <option value="2">Tier 2 ({cities.filter(c => c.tier === 2).length} Städte)</option>
            <option value="3">Tier 3 ({cities.filter(c => c.tier === 3).length} Städte)</option>
          </select>
          <button onClick={runBatch} disabled={batchRunning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg">
            {batchRunning ? '⏳ Batch läuft...' : '🚀 Batch starten'}
          </button>
        </div>
      </div>

      {batchMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">{batchMsg}</div>
      )}

      {/* Status Overview */}
      {wpStatus && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{wpStatus.total}</div>
            <div className="text-xs text-gray-500">Städte gesamt</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{wpStatus.generated}</div>
            <div className="text-xs text-gray-500">Content generiert</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{wpStatus.pushed}</div>
            <div className="text-xs text-gray-500">WordPress Drafts</div>
          </div>
        </div>
      )}

      {/* City List */}
      {wpStatus?.cities && (
        <div className="space-y-2">
          {[1,2,3].map(tier => (
            <div key={tier}>
              <h3 className="font-bold text-sm text-gray-500 mt-3 mb-2">{'⭐'.repeat(Math.max(0,4-tier))} Tier {tier}</h3>
              {wpStatus.cities.filter(c => c.tier === tier).map(c => (
                <div key={c.slug} className="bg-white rounded-lg border p-3 flex items-center gap-3">
                  <span className="text-lg">{STATUS_ICON[c.status] || '⚪'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{c.city}</div>
                    <div className="text-xs text-gray-400">
                      /schreiner-{c.slug}
                      {c.wordCount ? ` · ${c.wordCount}W` : ''}
                      {c.boardPass !== null ? ` · Board: ${c.boardPass ? '✅' : '❌'}` : ''}
                    </div>
                  </div>
                  {c.wpDraft ? (
                    <a href={c.wpUrl} target="_blank" rel="noopener"
                      className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full hover:bg-green-200">
                      📄 Draft öffnen
                    </a>
                  ) : (
                    <button onClick={() => pushSingle(c.slug)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-200">
                      🚀 Generieren + Pushen
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Knowledge Tab Component ──
function KnowledgeTab({ authFetch, stats }) {
  const [chunks, setChunks] = useState([]);
  const [embedStatus, setEmbedStatus] = useState(null);
  const [filter, setFilter] = useState('');
  const [embedding, setEmbedding] = useState(false);
  const [embedMsg, setEmbedMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newChunk, setNewChunk] = useState({ category: 'EXPERT_PRINCIPLE', subcategory: '', title: '', content: '' });

  const CATEGORIES = ['EXPERT_PRINCIPLE', 'PAGE_TEMPLATE', 'SCHEMA_TEMPLATE', 'LOKALKOLORIT', 'BRAND_SETTINGS', 'PRODUCT_INFO', 'CUSTOMER_VOICE', 'CUSTOMER_REVIEW', 'FAQ_ITEM', 'REFERENCE_PROJECT', 'COMPETITOR_DATA'];

  async function loadChunks() {
    const d = await authFetch('/api/knowledge?limit=200');
    if (d.success) setChunks(d.chunks);
    const s = await authFetch('/api/knowledge/embed-status');
    if (s.success) setEmbedStatus(s);
  }

  useEffect(() => { loadChunks(); }, []);

  async function handleEmbedAll() {
    setEmbedding(true); setEmbedMsg('');
    try {
      const d = await authFetch('/api/knowledge/embed-all', { method: 'POST' });
      setEmbedMsg(d.message || 'Gestartet...');
      const poll = setInterval(async () => {
        const s = await authFetch('/api/knowledge/embed-status');
        if (s.success) { setEmbedStatus(s); if (s.missing === 0) { clearInterval(poll); setEmbedding(false); setEmbedMsg('✅ Alle Embeddings fertig!'); loadChunks(); } }
      }, 5000);
      setTimeout(() => clearInterval(poll), 300000);
    } catch (e) { setEmbedMsg('Fehler: ' + e.message); setEmbedding(false); }
  }

  function startEdit(chunk) {
    setEditId(chunk.id);
    setEditData({ title: chunk.title, content: chunk.content, subcategory: chunk.subcategory || '' });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const d = await authFetch(`/api/knowledge/${editId}`, {
        method: 'PUT', body: JSON.stringify(editData),
      });
      if (d.success) {
        setEditId(null);
        setEmbedMsg('✅ Gespeichert + Embedding aktualisiert');
        await loadChunks();
      } else { alert('Fehler: ' + (d.error || 'Unbekannt')); }
    } catch (e) { alert('Fehler: ' + e.message); }
    setSaving(false);
  }

  async function deleteChunk(id, title) {
    if (!confirm(`"${title}" wirklich löschen?`)) return;
    await authFetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    await loadChunks();
  }

  async function addChunk() {
    if (!newChunk.title || !newChunk.content) return alert('Titel und Inhalt sind Pflicht.');
    setSaving(true);
    try {
      const d = await authFetch('/api/knowledge', {
        method: 'POST', body: JSON.stringify(newChunk),
      });
      if (d.success) {
        setAddMode(false);
        setNewChunk({ category: 'EXPERT_PRINCIPLE', subcategory: '', title: '', content: '' });
        setEmbedMsg('✅ Neuer Chunk erstellt + Embedding generiert');
        await loadChunks();
      } else { alert('Fehler: ' + (d.error || 'Unbekannt')); }
    } catch (e) { alert('Fehler: ' + e.message); }
    setSaving(false);
  }

  const categories = [...new Set(chunks.map(c => c.category))].sort();
  const filtered = filter ? chunks.filter(c => c.category === filter) : chunks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">🧠 RAG Knowledge Base</h2>
        <button onClick={() => setAddMode(!addMode)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition">
          {addMode ? '✕ Abbrechen' : '＋ Neuer Chunk'}
        </button>
      </div>

      {/* Add New Chunk */}
      {addMode && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Kategorie</label>
              <select value={newChunk.category} onChange={e => setNewChunk(p => ({ ...p, category: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Subcategory</label>
              <input value={newChunk.subcategory} onChange={e => setNewChunk(p => ({ ...p, subcategory: e.target.value }))}
                placeholder="z.B. dieter_rams, stuttgart" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Titel</label>
            <input value={newChunk.title} onChange={e => setNewChunk(p => ({ ...p, title: e.target.value }))}
              placeholder="z.B. Dieter Rams — Gutes Design" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Inhalt (wird für RAG-Retrieval genutzt)</label>
            <textarea value={newChunk.content} onChange={e => setNewChunk(p => ({ ...p, content: e.target.value }))}
              rows={5} placeholder="Der vollständige Wissens-Chunk..." className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono" />
          </div>
          <button onClick={addChunk} disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg">
            {saving ? '⏳ Speichern...' : '✅ Chunk erstellen + Embedding generieren'}
          </button>
        </div>
      )}

      {/* Embed Status Bar */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-medium">Embedding-Status</div>
          {embedStatus ? (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm">{embedStatus.embedded}/{embedStatus.total} Chunks embedded</span>
              {embedStatus.missing > 0 ? (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠️ {embedStatus.missing} fehlen</span>
              ) : (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✅ Komplett</span>
              )}
            </div>
          ) : <span className="text-xs text-gray-400">Laden...</span>}
          {embedMsg && <div className="text-xs text-blue-600 mt-1">{embedMsg}</div>}
        </div>
        <button onClick={handleEmbedAll} disabled={embedding || (embedStatus?.missing === 0)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition">
          {embedding ? '⏳ Läuft...' : '🧠 Embed All'}
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition ${!filter ? 'bg-orange-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          Alle ({chunks.length})
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${filter === cat ? 'bg-orange-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {cat} ({chunks.filter(c => c.category === cat).length})
          </button>
        ))}
      </div>

      {/* Chunk List */}
      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} className={`bg-white rounded-lg border p-3 ${editId === c.id ? 'border-orange-400 ring-2 ring-orange-100' : ''}`}>
            {editId === c.id ? (
              /* ── EDIT MODE ── */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">{c.category}</span>
                  <input value={editData.subcategory} onChange={e => setEditData(p => ({ ...p, subcategory: e.target.value }))}
                    placeholder="Subcategory" className="border rounded px-2 py-1 text-xs w-40" />
                  <span className="ml-auto text-gray-400">Bearbeiten</span>
                </div>
                <input value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-medium" />
                <textarea value={editData.content} onChange={e => setEditData(p => ({ ...p, content: e.target.value }))}
                  rows={8} className="w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed" />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg">
                    {saving ? '⏳...' : '💾 Speichern + Re-Embed'}
                  </button>
                  <button onClick={() => setEditId(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${c.hasEmbedding ? 'bg-green-500' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{c.category}</span>
                    {c.subcategory && <span className="text-xs text-gray-400">{c.subcategory}</span>}
                  </div>
                  <div className="font-medium text-sm mt-1 truncate">{c.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{c.content?.slice(0, 200)}...</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(c)} title="Bearbeiten"
                    className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-600 transition">
                    ✏️
                  </button>
                  <button onClick={() => deleteChunk(c.id, c.title)} title="Löschen"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition">
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-gray-400 text-center py-8">Keine Chunks gefunden.</p>}
      </div>
    </div>
  );
}

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
  const [socialResults, setSocialResults] = useState(null);
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
    { id: 'wordpress', label: '🌐 WordPress', desc: 'Batch-Push alle Städte' },
    { id: 'social', label: '📢 Social', desc: 'GBP · Insta · Pinterest · Blog' },
    { id: 'history', label: '📋 Verlauf', desc: 'Alle Generierungen' },
    { id: 'cities', label: '🏙️ Städte', desc: 'Ort-Profile & Priorisierung' },
    { id: 'knowledge', label: '🧠 Wissen', desc: 'RAG Knowledge Base' },
    { id: 'users', label: '👥 Benutzer', desc: 'Zugänge verwalten' },
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

                  {/* WordPress Export */}
                  {currentGen.outputContent && (
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(currentGen.outputContent).then(() => alert('✅ Markdown kopiert!'))}
                        className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
                        📋 Markdown kopieren
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`Seite als Elementor-Draft nach WordPress pushen?`)) return;
                        const d = await authFetch(`/api/export/wordpress/${currentGen.id}`, { method: 'POST' });
                        alert(d.success ? `✅ WordPress Draft erstellt!\n\n📄 ${d.title}\n🔗 ${d.wpUrl}\n📊 Slug: /${d.slug}` : `❌ Fehler: ${d.error}`);
                      }}
                        className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">
                        🚀 → WordPress Elementor (Draft)
                      </button>
                    </div>
                  )}

                  {/* Social Content Bulk */}
                  {currentGen.outputContent && (
                    <button onClick={async () => {
                      const d = await authFetch(`/api/social/bulk/${currentGen.id}`, { method: 'POST' });
                      if (d.success) {
                        setSocialResults(d.results);
                        alert('✅ Social Content für alle 4 Kanäle generiert! Wechsle zum Social-Tab für Details.');
                      } else alert('❌ ' + d.error);
                    }}
                      className="w-full border-2 border-dashed border-orange-300 rounded-lg py-2 text-sm font-medium text-orange-600 hover:bg-orange-50">
                      📢 Social Content generieren (GBP · Insta · Pinterest · Blog)
                    </button>
                  )}

                  {/* Inline Social Results */}
                  {socialResults && Object.keys(socialResults).length > 0 && (
                    <details className="bg-orange-50 rounded-xl border border-orange-200">
                      <summary className="p-3 cursor-pointer text-sm font-medium text-orange-700">📢 {Object.keys(socialResults).length} Social-Kanäle generiert</summary>
                      <div className="p-3 space-y-3">
                        {Object.entries(socialResults).map(([ch, data]) => (
                          <div key={ch} className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-sm">{ch === 'gbp' ? '📍 Google Business' : ch === 'instagram' ? '📸 Instagram' : ch === 'pinterest' ? '📌 Pinterest' : '📝 Blog'}</span>
                              <button onClick={() => navigator.clipboard.writeText(data.raw || data.content || '').then(() => alert('Kopiert!'))}
                                className="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200">📋 Kopieren</button>
                            </div>
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">{(data.raw || data.content || '').slice(0, 500)}{(data.raw || '').length > 500 ? '...' : ''}</pre>
                          </div>
                        ))}
                      </div>
                    </details>
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

        {/* ═══ WORDPRESS TAB ═══ */}
        {tab === 'wordpress' && <WordPressTab authFetch={authFetch} cities={cities} />}

        {/* ═══ KNOWLEDGE TAB ═══ */}
        {tab === 'knowledge' && <KnowledgeTab authFetch={authFetch} stats={stats} />}

        {/* ═══ SOCIAL TAB ═══ */}
        {tab === 'social' && <SocialTab authFetch={authFetch} />}

        {/* ═══ USERS TAB ═══ */}
        {tab === 'users' && <UsersTab authFetch={authFetch} currentUser={user} />}

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
