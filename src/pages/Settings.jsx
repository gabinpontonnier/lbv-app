import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const [tab, setTab] = useState('residents') // 'residents' | 'articles' | 'calendriers'

  // Résidents
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [residents, setResidents] = useState([])
  const [newName, setNewName] = useState('')
  const [newRoom, setNewRoom] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Articles
  const [articles, setArticles] = useState([])
  const [newArticleName, setNewArticleName] = useState('')
  const [savingArticle, setSavingArticle] = useState(false)

  // Calendriers iCal
  const [concierges, setConcierges] = useState([])
  const [icalEdits, setIcalEdits] = useState({}) // { [id]: { url, petit, grand } }
  const [icalSaving, setIcalSaving] = useState(null)

  useEffect(() => {
    supabase.from('clients').select('*').eq('type', 'residence').order('name').then(({ data }) => {
      if (data) {
        setClients(data)
        if (data.length > 0) setSelectedClientId(data[0].id)
      }
    })
    supabase.from('clients').select('*').eq('type', 'conciergerie').order('name').then(({ data }) => {
      if (data) {
        setConcierges(data)
        const edits = {}
        data.forEach(c => { edits[c.id] = { url: c.ical_url || '', petit: c.default_petit_kits ?? 1, grand: c.default_grand_kits ?? 0 } })
        setIcalEdits(edits)
      }
    })
  }, [])

  const saveIcal = async (id) => {
    setIcalSaving(id)
    const e = icalEdits[id]
    await supabase.from('clients').update({ ical_url: e.url.trim() || null, default_petit_kits: e.petit, default_grand_kits: e.grand }).eq('id', id)
    setIcalSaving(null)
  }

  useEffect(() => {
    if (!selectedClientId) return
    setLoading(true)
    supabase
      .from('residents')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('name')
      .then(({ data }) => {
        setResidents(data || [])
        setLoading(false)
      })
  }, [selectedClientId])

  const addResident = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('residents')
      .insert({ client_id: selectedClientId, name: newName.trim(), room: newRoom.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setResidents(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewRoom('')
    }
    setSaving(false)
  }

  const toggleActive = async (resident) => {
    const { error } = await supabase
      .from('residents')
      .update({ active: !resident.active })
      .eq('id', resident.id)
    if (!error) {
      setResidents(prev =>
        prev.map(r => r.id === resident.id ? { ...r, active: !r.active } : r)
      )
    }
  }

  const deleteResident = async (id) => {
    if (!confirm('Supprimer ce résident ?')) return
    const { error } = await supabase.from('residents').delete().eq('id', id)
    if (!error) setResidents(prev => prev.filter(r => r.id !== id))
  }

  const activeResidents = residents.filter(r => r.active)
  const inactiveResidents = residents.filter(r => !r.active)

  useEffect(() => {
    supabase.from('articles').select('*').order('sort_order').then(({ data }) => {
      if (data) setArticles(data)
    })
  }, [])

  const addArticle = async (e) => {
    e.preventDefault()
    if (!newArticleName.trim()) return
    setSavingArticle(true)
    const maxOrder = articles.reduce((m, a) => Math.max(m, a.sort_order || 0), 0)
    const { data, error } = await supabase
      .from('articles')
      .insert({ name: newArticleName.trim(), category: 'standard', sort_order: maxOrder + 1 })
      .select().single()
    if (!error && data) {
      setArticles(prev => [...prev, data])
      setNewArticleName('')
    }
    setSavingArticle(false)
  }

  const deleteArticle = async (id) => {
    if (!confirm('Supprimer cet article ? Les livraisons existantes ne seront pas affectées.')) return
    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (!error) setArticles(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-5">Paramètres</h2>

      {/* Onglets */}
      <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
        <button onClick={() => setTab('residents')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === 'residents' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
          👥 Résidents
        </button>
        <button onClick={() => setTab('articles')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === 'articles' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
          🏷 Articles
        </button>
        <button onClick={() => setTab('calendriers')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === 'calendriers' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
          📅 iCal
        </button>
      </div>

      {/* ── Onglet Résidents ── */}
      {tab === 'residents' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            >
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <form onSubmit={addResident} className="flex gap-2 mb-5">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nom du résident"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={newRoom}
                onChange={e => setNewRoom(e.target.value)}
                placeholder="Ch."
                className="w-16 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-lg font-bold disabled:opacity-40 active:scale-95 transition-all"
              >
                +
              </button>
            </form>

            {loading ? (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-2">
                {activeResidents.length === 0 && inactiveResidents.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-4">Aucun résident. Ajoutez-en ci-dessus.</p>
                )}
                {activeResidents.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 bg-white">
                    <div>
                      <span className="font-semibold text-sm text-slate-800">{r.name}</span>
                      {r.room && <span className="text-xs text-slate-400 ml-2">ch. {r.room}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleActive(r)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-100 text-green-700 active:scale-95 transition-all">Actif</button>
                      <button onClick={() => deleteResident(r.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-400 active:scale-95 transition-all">✕</button>
                    </div>
                  </div>
                ))}
                {inactiveResidents.length > 0 && (
                  <>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider pt-2 pb-1">Inactifs</p>
                    {inactiveResidents.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 opacity-60">
                        <span className="font-semibold text-sm text-slate-600">{r.name}{r.room ? ` — ch. ${r.room}` : ''}</span>
                        <button onClick={() => toggleActive(r)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-500 active:scale-95 transition-all">Réactiver</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
            <p className="text-sm text-slate-600">Les résidents inactifs n'apparaissent plus dans le formulaire de livraison mais leurs données sont conservées.</p>
          </div>
        </>
      )}

      {/* ── Onglet Calendriers ── */}
      {tab === 'calendriers' && (
        <div className="space-y-4">
          {concierges.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Aucune conciergerie enregistrée.</p>}
          {concierges.map(c => {
            const e = icalEdits[c.id] || { url: '', petit: 1, grand: 0 }
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                <p className="font-bold text-slate-800">{c.name}</p>
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">URL iCal</p>
                  <input
                    value={e.url}
                    onChange={ev => setIcalEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], url: ev.target.value } }))}
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[['Petits kits / check-in', 'petit'], ['Grands kits / check-in', 'grand']].map(([label, key]) => (
                    <div key={key} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 font-semibold mb-2">{label}</p>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => setIcalEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], [key]: Math.max(0, prev[c.id][key] - 1) } }))} className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold text-sm">-</button>
                        <span className="font-bold text-slate-900 text-sm">{e[key]}</span>
                        <button type="button" onClick={() => setIcalEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], [key]: prev[c.id][key] + 1 } }))} className="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold text-sm text-blue-600">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => saveIcal(c.id)} disabled={icalSaving === c.id} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95">
                  {icalSaving === c.id ? 'Sauvegarde...' : '✓ Sauvegarder'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Onglet Articles ── */}
      {tab === 'articles' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
            <p className="text-xs text-slate-400 mb-3">Ces articles apparaissent dans les formulaires de livraison résidence.</p>
            <form onSubmit={addArticle} className="flex gap-2 mb-4">
              <input
                value={newArticleName}
                onChange={e => setNewArticleName(e.target.value)}
                placeholder="Nom de l'article"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={savingArticle || !newArticleName.trim()}
                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-lg font-bold disabled:opacity-40 active:scale-95 transition-all"
              >
                +
              </button>
            </form>
            <div className="space-y-2">
              {articles.map(a => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200">
                  <span className="text-sm font-semibold text-slate-800">{a.name}</span>
                  <button
                    onClick={() => deleteArticle(a.id)}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-400 active:scale-95 transition-all"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {articles.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">Aucun article.</p>
              )}
            </div>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <p className="text-sm text-slate-600">⚠️ Supprimer un article ne supprime pas les livraisons passées qui le contiennent.</p>
          </div>
        </>
      )}
    </div>
  )
}
