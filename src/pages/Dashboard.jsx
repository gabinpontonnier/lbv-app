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

// Lundi de la semaine contenant `iso`
function weekStart(iso) {
  const d = new Date(iso + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

function weekDays(startISO) {
  return Array.from({ length: 7 }, (_, i) => shiftDate(startISO, i))
}

function shortDay(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

function DeliveryCard({ del, client, onDelete, deleting, onConfirm }) {
  const isConfirmed = del.status === 'confirmed'
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border ${isConfirmed ? 'border-green-200' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{client?.name || '—'}</span>
          {isConfirmed && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Confirmé</span>}
        </div>
        <span className="text-xs text-slate-400">
          {new Date(del.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {client?.type === 'conciergerie' ? (
        <div className="text-sm text-slate-600 space-y-1">
          {del.petit_kits > 0 && <p>🔵 {del.petit_kits} petit{del.petit_kits > 1 ? 's' : ''} kit{del.petit_kits > 1 ? 's' : ''}</p>}
          {del.grand_kits > 0 && <p>🟣 {del.grand_kits} grand{del.grand_kits > 1 ? 's' : ''} kit{del.grand_kits > 1 ? 's' : ''}</p>}
          {del.total_weight && <p className="font-semibold text-blue-600">⚖️ {del.total_weight} kg</p>}
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

      {del.notes && <p className="text-xs text-slate-400 mt-2 italic border-t border-slate-50 pt-2">📝 {del.notes}</p>}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
        {!isConfirmed ? (
          <button
            onClick={() => onConfirm(del.id)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-green-50 text-green-700 active:scale-95 transition-all"
          >
            ✓ Marquer livré
          </button>
        ) : <span />}
        <button
          onClick={() => onDelete(del.id)}
          disabled={deleting === del.id}
          className="text-xs text-red-400 font-semibold disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          {deleting === del.id ? '...' : '🗑'}
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [viewMode, setViewMode] = useState('day') // 'day' | 'week'
  const [selectedDate, setSelectedDate] = useState(todayISO)
  const [weekBase, setWeekBase] = useState(weekStart(todayISO))
  const [deliveries, setDeliveries] = useState([])
  const [weekDeliveries, setWeekDeliveries] = useState({})
  const [clientsMap, setClientsMap] = useState({})
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('clients').select('*').then(({ data }) => {
      if (data) setClientsMap(Object.fromEntries(data.map(c => [c.id, c])))
    })
    supabase.from('delivery_requests').select('*, clients(name)').gte('requested_date', todayISO).order('requested_date').then(({ data }) => setRequests(data || []))
  }, [])

  const loadDay = useCallback(async (date) => {
    setLoading(true)
    const { data } = await supabase
      .from('deliveries')
      .select('*, delivery_items(*, articles(*), residents(*))')
      .eq('delivery_date', date)
      .order('created_at', { ascending: false })
    setDeliveries(data || [])
    setLoading(false)
  }, [])

  const loadWeek = useCallback(async (start) => {
    setLoading(true)
    const days = weekDays(start)
    const [{ data: dels }, { data: reqs }] = await Promise.all([
      supabase.from('deliveries').select('*, delivery_items(*, articles(*), residents(*))').gte('delivery_date', days[0]).lte('delivery_date', days[6]).order('delivery_date'),
      supabase.from('delivery_requests').select('*, clients(name)').gte('requested_date', days[0]).lte('requested_date', days[6]).order('requested_date'),
    ])
    const grouped = {}
    days.forEach(d => { grouped[d] = { deliveries: [], requests: [] } })
    ;(dels || []).forEach(d => { if (grouped[d.delivery_date]) grouped[d.delivery_date].deliveries.push(d) })
    ;(reqs || []).forEach(r => { if (grouped[r.requested_date]) grouped[r.requested_date].requests.push(r) })
    setWeekDeliveries(grouped)
    setLoading(false)
  }, [])

  useEffect(() => { if (viewMode === 'day') loadDay(selectedDate) }, [selectedDate, viewMode, loadDay])
  useEffect(() => { if (viewMode === 'week') loadWeek(weekBase) }, [weekBase, viewMode, loadWeek])

  const deleteDelivery = async (id) => {
    if (!confirm('Supprimer cette livraison ?')) return
    setDeleting(id)
    await supabase.from('deliveries').delete().eq('id', id)
    setDeliveries(prev => prev.filter(d => d.id !== id))
    setWeekDeliveries(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = next[k].filter(d => d.id !== id) })
      return next
    })
    setDeleting(null)
  }

  const confirmDelivery = async (id) => {
    await supabase.from('deliveries').update({ status: 'confirmed' }).eq('id', id)
    const update = d => d.id === id ? { ...d, status: 'confirmed' } : d
    setDeliveries(prev => prev.map(update))
    setWeekDeliveries(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = next[k].map(update) })
      return next
    })
  }

  const markRequestSeen = async (id) => {
    await supabase.from('delivery_requests').update({ status: 'seen' }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'seen' } : r))
  }

  const isToday = selectedDate === todayISO
  const days = weekDays(weekBase)

  return (
    <div className="px-4 py-6">
      {/* Header + toggle vue */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-slate-900">{isToday && viewMode === 'day' ? 'Bonjour 👋' : 'Livraisons'}</h2>
        <div className="flex bg-slate-100 rounded-xl p-0.5">
          <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Jour</button>
          <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Semaine</button>
        </div>
      </div>

      {/* Demandes en attente */}
      {requests.filter(r => r.status === 'pending').length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">🔔 Demandes conciergerie</p>
          {requests.filter(r => r.status === 'pending').map(r => (
            <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-slate-800">{new Date(r.requested_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                <p className="text-xs text-slate-600">
                  {[r.petit_kits > 0 && `${r.petit_kits} petit${r.petit_kits > 1 ? 's' : ''}`, r.grand_kits > 0 && `${r.grand_kits} grand${r.grand_kits > 1 ? 's' : ''}`].filter(Boolean).join(' + ')}
                  {r.notes && ` — ${r.notes}`}
                </p>
              </div>
              <button onClick={() => markRequestSeen(r.id)} className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg shrink-0 active:scale-95">✓ Vu</button>
            </div>
          ))}
        </div>
      )}

      {/* ── VUE JOUR ── */}
      {viewMode === 'day' && (
        <>
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 p-3 mb-5 shadow-sm">
            <button onClick={() => setSelectedDate(d => shiftDate(d, -1))} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 font-bold text-lg active:scale-90 transition-all">‹</button>
            <div className="text-center">
              <p className="font-bold text-slate-900 capitalize">{formatDate(selectedDate)}</p>
              {!isToday && <button onClick={() => setSelectedDate(todayISO)} className="text-xs text-blue-600 font-semibold">← Aujourd'hui</button>}
            </div>
            <button onClick={() => setSelectedDate(d => shiftDate(d, 1))} disabled={selectedDate >= todayISO} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 font-bold text-lg active:scale-90 transition-all disabled:opacity-20">›</button>
          </div>

          {isToday && (
            <button onClick={() => navigate('/livraison')} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg mb-5 flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-95 transition-all">
              <span className="text-2xl">📦</span> Nouvelle livraison
            </button>
          )}

          {loading ? <div className="text-center py-12"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          : deliveries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm">Aucune livraison ce jour-là.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map(del => (
                <DeliveryCard key={del.id} del={del} client={clientsMap[del.client_id]} onDelete={deleteDelivery} deleting={deleting} onConfirm={confirmDelivery} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── VUE SEMAINE ── */}
      {viewMode === 'week' && (
        <>
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 p-3 mb-5 shadow-sm">
            <button onClick={() => setWeekBase(d => shiftDate(d, -7))} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 font-bold text-lg active:scale-90 transition-all">‹</button>
            <p className="font-bold text-sm text-slate-700">
              {new Date(days[0] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {new Date(days[6] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </p>
            <button onClick={() => setWeekBase(d => shiftDate(d, 7))} disabled={weekBase > weekStart(todayISO)} className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 font-bold text-lg active:scale-90 transition-all disabled:opacity-20">›</button>
          </div>

          {loading ? <div className="text-center py-12"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          : (
            <div className="space-y-3">
              {days.map(day => {
                const dayDels = weekDeliveries[day]?.deliveries || []
                const dayReqsCount = (weekDeliveries[day]?.requests || []).length
                const isT = day === todayISO
                const isFuture = day > todayISO
                return (
                  <div key={day} className={`rounded-2xl border overflow-hidden ${isT ? 'border-blue-200' : 'border-slate-100'}`}>
                    <div className={`px-4 py-2.5 flex items-center justify-between ${isT ? 'bg-blue-600' : 'bg-slate-50'}`}>
                      <p className={`font-bold text-sm capitalize ${isT ? 'text-white' : 'text-slate-700'}`}>{shortDay(day)}{isT ? ' — Aujourd\'hui' : ''}</p>
                      <div className="flex items-center gap-1.5">
                        {dayDels.length > 0 && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isT ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'}`}>{dayDels.length}</span>}
                        {dayReqsCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-700">📅 {dayReqsCount}</span>}
                        {dayDels.length === 0 && dayReqsCount === 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-400">0</span>}
                      </div>
                    </div>
                    {(() => {
                      const dayDels = weekDeliveries[day]?.deliveries || []
                      const dayReqs = weekDeliveries[day]?.requests || []
                      return (
                        <>
                          {dayDels.length > 0 && (
                            <div className="divide-y divide-slate-50">
                              {dayDels.map(del => (
                                <DeliveryCard key={del.id} del={del} client={clientsMap[del.client_id]} onDelete={deleteDelivery} deleting={deleting} onConfirm={confirmDelivery} />
                              ))}
                            </div>
                          )}
                          {dayReqs.length > 0 && (
                            <div className="divide-y divide-amber-50">
                              {dayReqs.map(r => (
                                <div key={r.id} className="px-4 py-2.5 bg-amber-50 flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-bold text-amber-700">📅 Demande — {r.clients?.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {[r.petit_kits > 0 && `${r.petit_kits} petit${r.petit_kits > 1 ? 's' : ''}`, r.grand_kits > 0 && `${r.grand_kits} grand${r.grand_kits > 1 ? 's' : ''}`].filter(Boolean).join(' + ')}
                                      {r.notes ? ` — ${r.notes}` : ''}
                                    </p>
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === 'seen' ? 'bg-green-100 text-green-600' : 'bg-amber-200 text-amber-700'}`}>
                                    {r.status === 'seen' ? 'Vu' : '!'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {dayDels.length === 0 && dayReqs.length === 0 && !isFuture && (
                            <p className="text-xs text-slate-400 text-center py-3">Aucune livraison</p>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
