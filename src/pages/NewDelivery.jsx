import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Composant compteur +/- ────────────────────────────────────────────────────
function Counter({ label, value, onChange, sub }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
      <div>
        <p className="font-semibold text-slate-800 text-sm">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-10 h-10 rounded-full border-2 border-slate-200 text-xl font-bold flex items-center justify-center active:scale-90 transition-all hover:border-blue-400 hover:text-blue-600"
        >
          −
        </button>
        <span className="text-2xl font-bold w-8 text-center tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all hover:bg-blue-700"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ─── Formulaire Conciergerie ───────────────────────────────────────────────────
function ConciergeriForm({ clientId, kitCompositions, articlesMap, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [petitKits, setPetitKits] = useState(0)
  const [grandKits, setGrandKits] = useState(0)
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const calcTotals = () => {
    const totals = {}
    kitCompositions.forEach(kc => {
      const count = kc.kit_type === 'petit' ? petitKits : grandKits
      const qty = count * kc.quantity
      if (qty > 0) {
        const name = articlesMap[kc.article_id]?.name || '?'
        totals[name] = (totals[name] || 0) + qty
      }
    })
    return totals
  }

  const totals = calcTotals()
  const totalKits = petitKits + grandKits

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (totalKits === 0) return alert('Ajoutez au moins 1 kit.')
    if (!weight.trim()) return alert('Entrez le poids.')
    setSaving(true)
    const { error } = await supabase.from('deliveries').insert({
      client_id: clientId,
      delivery_date: date,
      petit_kits: petitKits,
      grand_kits: grandKits,
      total_weight: parseFloat(weight.replace(',', '.')),
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (error) return alert('Erreur : ' + error.message)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Counter
        label="🔵 Petit kit"
        sub="2 personnes — lit 160"
        value={petitKits}
        onChange={setPetitKits}
      />
      <Counter
        label="🟣 Grand kit"
        sub="4 personnes — lit 160 + lit 140"
        value={grandKits}
        onChange={setGrandKits}
      />

      {totalKits > 0 && (
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">
            Détail calculé ({totalKits} kit{totalKits > 1 ? 's' : ''})
          </p>
          <div className="space-y-1.5">
            {Object.entries(totals).map(([name, qty]) => (
              <div key={name} className="flex justify-between text-sm">
                <span className="text-slate-600">{name}</span>
                <span className="font-bold text-slate-900">×{qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">Poids total (kg)</label>
        <input
          type="text"
          inputMode="decimal"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="ex: 8.5"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">Notes (optionnel)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Remarques particulières..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-blue-200"
      >
        {saving ? 'Enregistrement...' : '✓ Valider la livraison'}
      </button>
    </form>
  )
}

// ─── Formulaire Résidence ──────────────────────────────────────────────────────
function ResidenceForm({ clientId, residents, articlesList, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [residentId, setResidentId] = useState('')
  const [quantities, setQuantities] = useState({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const setQty = (articleId, qty) =>
    setQuantities(prev => ({ ...prev, [articleId]: Math.max(0, qty) }))

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!residentId) return alert('Sélectionnez un résident.')
    if (totalItems === 0) return alert('Ajoutez au moins 1 article.')
    setSaving(true)

    const { data: del, error: delErr } = await supabase
      .from('deliveries')
      .insert({ client_id: clientId, delivery_date: date, notes: notes.trim() || null })
      .select()
      .single()

    if (delErr || !del) {
      setSaving(false)
      return alert('Erreur : ' + delErr?.message)
    }

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([article_id, quantity]) => ({
        delivery_id: del.id,
        article_id,
        resident_id: residentId,
        quantity,
      }))

    const { error: itemsErr } = await supabase.from('delivery_items').insert(items)
    setSaving(false)
    if (itemsErr) return alert('Erreur articles : ' + itemsErr.message)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">Résident</label>
        <select
          value={residentId}
          onChange={e => setResidentId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">— Sélectionnez —</option>
          {residents.map(r => (
            <option key={r.id} value={r.id}>
              {r.name}{r.room ? ` (ch. ${r.room})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-600 mb-2">Articles livrés</p>
        <div className="space-y-2">
          {articlesList.map(article => (
            <Counter
              key={article.id}
              label={article.name}
              value={quantities[article.id] || 0}
              onChange={qty => setQty(article.id, qty)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-1">Notes (optionnel)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Remarques particulières..."
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-blue-200"
      >
        {saving ? 'Enregistrement...' : '✓ Valider la livraison'}
      </button>
    </form>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function NewDelivery() {
  const [step, setStep] = useState('client')
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [kitCompositions, setKitCompositions] = useState([])
  const [articlesMap, setArticlesMap] = useState({})
  const [articlesList, setArticlesList] = useState([])
  const [residents, setResidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: cls }, { data: kcs }, { data: arts }] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('kit_compositions').select('*'),
        supabase.from('articles').select('*').order('sort_order'),
      ])
      if (cls) setClients(cls)
      if (kcs) setKitCompositions(kcs)
      if (arts) {
        setArticlesMap(Object.fromEntries(arts.map(a => [a.id, a])))
        setArticlesList(arts)
      }
      setLoading(false)
    }
    load()
  }, [])

  const selectClient = async (client) => {
    setSelectedClient(client)
    if (client.type === 'residence') {
      const { data } = await supabase
        .from('residents')
        .select('*')
        .eq('client_id', client.id)
        .eq('active', true)
        .order('name')
      setResidents(data || [])
    }
    setStep('form')
  }

  const handleSaved = () => {
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setStep('client')
      setSelectedClient(null)
      setResidents([])
    }, 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-slate-900">Livraison enregistrée !</h2>
      <p className="text-slate-400 mt-2 text-sm">Retour dans un instant...</p>
    </div>
  )

  return (
    <div className="px-4 py-6">
      {step === 'client' ? (
        <>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Nouvelle livraison</h2>
          <p className="text-sm text-slate-500 mb-6">Sélectionnez le client :</p>
          <div className="space-y-3">
            {clients.map(client => (
              <button
                key={client.id}
                onClick={() => selectClient(client)}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-left hover:border-blue-300 hover:shadow-md active:scale-98 transition-all"
              >
                <div className="font-bold text-slate-900 text-lg">{client.name}</div>
                <div className="text-sm text-slate-400 mt-1">
                  {client.type === 'conciergerie'
                    ? '🔑 Conciergerie • Facturation au poids'
                    : "🏠 Résidence • Facturation à l'article"}
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => { setStep('client'); setSelectedClient(null) }}
              className="text-blue-600 font-semibold text-sm"
            >
              ← Retour
            </button>
            <h2 className="text-lg font-bold text-slate-900 truncate">{selectedClient?.name}</h2>
          </div>

          {selectedClient?.type === 'conciergerie' ? (
            <ConciergeriForm
              clientId={selectedClient.id}
              kitCompositions={kitCompositions}
              articlesMap={articlesMap}
              onSaved={handleSaved}
            />
          ) : (
            <ResidenceForm
              clientId={selectedClient.id}
              residents={residents}
              articlesList={articlesList}
              onSaved={handleSaved}
            />
          )}
        </>
      )}
    </div>
  )
}
