import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const todayISO = new Date().toISOString().slice(0, 10)

function shiftDate(iso, days) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDate(iso) {
  if (iso === todayISO) return "Aujourd'hui"
  if (iso === shiftDate(todayISO, -1)) return 'Hier'
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(todayISO)
  const [deliveries, setDeliveries] = useState([])
  const [clientsMap, setClientsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const navigate = useNavigate()

  const deleteDelivery = async (id) => {
    if (!confirm('Supprimer cette livraison ?')) return
    setDeleting(id)
    await supabase.from('deliveries').delete().eq('id', id)
    setDeliveries(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }

  const loadDeliveries = useCallback(async (date) => {
    setLoading(true)
    const { data: dels } = await supabase
      .from('deliveries')
      .select('*, delivery_items(*, articles(*), residents(*))')
      .eq('delivery_date', date)
      .order('created_at', { ascending: false })
    setDeliveries(dels || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.from('clients').select('*').then(({ data }) => {
      if (data) setClientsMap(Object.fromEntries(data.map(c => [c.id, c])))
    })
  }, [])

  useEffect(() => {
    loadDeliveries(selectedDate)
  }, [selectedDate, loadDeliveries])

  const isToday = selectedDate === todayISO

  return (
    <div className="px-4 py-6">
      {isToday && (
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-slate-900">Bonjour 👋</h2>
        </div>
      )}

      {/* Navigateur de date */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 p-3 mb-5 shadow-sm">
        <button
          onClick={() => setSelectedDate(d => shiftDate(d, -1))}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 font-bold text-lg active:scale-90 transition-all"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-bold text-slate-900 capitalize">{formatDate(selectedDate)}</p>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayISO)}
              className="text-xs text-blue-600 font-semibold mt-0.5"
            >
              ← Retour à aujourd'hui
            </button>
          )}
        </div>
        <button
          onClick={() => setSelectedDate(d => shiftDate(d, 1))}
          disabled={selectedDate >= todayISO}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 font-bold text-lg active:scale-90 transition-all disabled:opacity-20"
        >
          ›
        </button>
      </div>

      {isToday && (
        <button
          onClick={() => navigate('/livraison')}
          className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg mb-6 flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-95 transition-all"
        >
          <span className="text-2xl">📦</span>
          Nouvelle livraison
        </button>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-700">
          {isToday ? 'Livraisons du jour' : 'Livraisons'}
        </h3>
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
          {deliveries.length}
        </span>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {!loading && deliveries.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm">Aucune livraison ce jour-là.</p>
          {isToday && <p className="text-xs mt-1">Appuyez sur le bouton ci-dessus pour commencer.</p>}
        </div>
      )}

      <div className="space-y-3">
        {deliveries.map(del => {
          const client = clientsMap[del.client_id]
          return (
            <div key={del.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <span className="font-bold text-slate-900">{client?.name || '—'}</span>
                <span className="text-xs text-slate-400">
                  {new Date(del.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {client?.type === 'conciergerie' ? (
                <div className="text-sm text-slate-600 space-y-1">
                  {del.petit_kits > 0 && (
                    <p>🔵 {del.petit_kits} petit{del.petit_kits > 1 ? 's' : ''} kit{del.petit_kits > 1 ? 's' : ''}</p>
                  )}
                  {del.grand_kits > 0 && (
                    <p>🟣 {del.grand_kits} grand{del.grand_kits > 1 ? 's' : ''} kit{del.grand_kits > 1 ? 's' : ''}</p>
                  )}
                  {del.total_weight && (
                    <p className="font-semibold text-blue-600">⚖️ {del.total_weight} kg</p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-600 space-y-1">
                  {del.delivery_items?.length > 0 ? (
                    Object.entries(
                      del.delivery_items.reduce((acc, item) => {
                        const r = item.residents?.name || 'Non assigné'
                        if (!acc[r]) acc[r] = []
                        acc[r].push(`${item.articles?.name} ×${item.quantity}`)
                        return acc
                      }, {})
                    ).map(([resident, items]) => (
                      <div key={resident}>
                        <span className="font-semibold text-slate-700">{resident}</span>
                        <span className="text-slate-500"> — {items.join(', ')}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic text-xs">Aucun article</p>
                  )}
                </div>
              )}

              {del.notes && (
                <p className="text-xs text-slate-400 mt-2 italic border-t border-slate-50 pt-2">📝 {del.notes}</p>
              )}

              <div className="flex justify-end mt-3 pt-2 border-t border-slate-50">
                <button
                  onClick={() => deleteDelivery(del.id)}
                  disabled={deleting === del.id}
                  className="text-xs text-red-400 hover:text-red-600 font-semibold disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {deleting === del.id ? 'Suppression...' : '🗑 Supprimer'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
