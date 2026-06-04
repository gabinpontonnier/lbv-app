import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import WeekStrip from '../components/WeekStrip'

const todayISO = new Date().toISOString().slice(0, 10)

function shiftDate(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function weekStart(iso) {
  const d = new Date(iso + 'T12:00:00')
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

function weekDays(startISO) {
  return Array.from({ length: 7 }, (_, i) => shiftDate(startISO, i))
}

function formatDay(iso) {
  if (iso === todayISO) return "Aujourd'hui"
  if (iso === shiftDate(todayISO, -1)) return 'Hier'
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
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
  const [weekBase, setWeekBase] = useState(weekStart(todayISO))
  const [selectedDay, setSelectedDay] = useState(todayISO)
  const [weekData, setWeekData] = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const [clientsMap, setClientsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const navigate = useNavigate()

  const days = weekDays(weekBase)

  useEffect(() => {
    supabase.from('clients').select('*').then(({ data }) => {
      if (data) setClientsMap(Object.fromEntries(data.map(c => [c.id, c])))
    })
    supabase.from('delivery_requests').select('id', { count: 'exact' }).eq('status', 'pending').gte('requested_date', todayISO).then(({ count }) => setPendingCount(count || 0))
  }, [])

  const loadWeek = useCallback(async (start) => {
    setLoading(true)
    const d = weekDays(start)
    const [{ data: dels }, { data: reqs }] = await Promise.all([
      supabase.from('deliveries').select('*, delivery_items(*, articles(*), residents(*))').gte('delivery_date', d[0]).lte('delivery_date', d[6]).order('created_at', { ascending: false }),
      supabase.from('delivery_requests').select('*, clients(name)').gte('requested_date', d[0]).lte('requested_date', d[6]).order('requested_date'),
    ])
    const grouped = {}
    d.forEach(day => { grouped[day] = { deliveries: [], requests: [] } })
    ;(dels || []).forEach(del => { if (grouped[del.delivery_date]) grouped[del.delivery_date].deliveries.push(del) })
    ;(reqs || []).forEach(req => { if (grouped[req.requested_date]) grouped[req.requested_date].requests.push(req) })
    setWeekData(grouped)
    setLoading(false)
  }, [])

  useEffect(() => { loadWeek(weekBase) }, [weekBase, loadWeek])

  const handlePrevWeek = () => { const nb = shiftDate(weekBase, -7); setWeekBase(nb); setSelectedDay(nb) }
  const handleNextWeek = () => { const nb = shiftDate(weekBase, 7); setWeekBase(nb); setSelectedDay(nb) }

  const deleteDelivery = async (id) => {
    if (!confirm('Supprimer cette livraison ?')) return
    setDeleting(id)
    await supabase.from('deliveries').delete().eq('id', id)
    setWeekData(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = { ...next[k], deliveries: next[k].deliveries.filter(d => d.id !== id) } })
      return next
    })
    setDeleting(null)
  }

  const confirmDelivery = async (id) => {
    await supabase.from('deliveries').update({ status: 'confirmed' }).eq('id', id)
    setWeekData(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = { ...next[k], deliveries: next[k].deliveries.map(d => d.id === id ? { ...d, status: 'confirmed' } : d) } })
      return next
    })
  }

  const markRequestSeen = async (id) => {
    await supabase.from('delivery_requests').update({ status: 'seen' }).eq('id', id)
    setPendingCount(c => Math.max(0, c - 1))
    setWeekData(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = { ...next[k], requests: next[k].requests.map(r => r.id === id ? { ...r, status: 'seen' } : r) } })
      return next
    })
  }

  const stripMeta = {}
  days.forEach(day => {
    const d = weekData[day]
    if (d) stripMeta[day] = { deliveries: d.deliveries.length, requests: d.requests.length }
  })

  const isToday = selectedDay === todayISO
  const isFuture = selectedDay > todayISO
  const dayDeliveries = weekData[selectedDay]?.deliveries || []
  const dayRequests = weekData[selectedDay]?.requests || []

  return (
    <div className="px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900">{isToday ? 'Bonjour 👋' : 'Livraisons'}</h2>
        {pendingCount > 0 && (
          <span className="bg-amber-400 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            🔔 {pendingCount}
          </span>
        )}
      </div>

      {/* WeekStrip horizontal */}
      <div className="bg-white rounded-2xl border border-slate-100 px-2 py-3 mb-4 shadow-sm">
        <WeekStrip
          days={days}
          selected={selectedDay}
          onSelect={setSelectedDay}
          meta={stripMeta}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
          canNext={true}
        />
      </div>

      {/* CTA aujourd'hui */}
      {isToday && (
        <button onClick={() => navigate('/livraison')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base mb-4 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all">
          📦 Nouvelle livraison
        </button>
      )}

      {/* En-tête du jour sélectionné */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-700 capitalize text-sm">{formatDay(selectedDay)}</h3>
        <div className="flex gap-1.5">
          {dayDeliveries.length > 0 && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{dayDeliveries.length} livraison{dayDeliveries.length > 1 ? 's' : ''}</span>}
          {dayRequests.length > 0 && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">📅 {dayRequests.length}</span>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {dayDeliveries.map(del => (
            <DeliveryCard key={del.id} del={del} client={clientsMap[del.client_id]} onDelete={deleteDelivery} deleting={deleting} onConfirm={confirmDelivery} />
          ))}

          {dayRequests.map(req => (
            <div key={req.id} className={`rounded-2xl p-4 border ${req.status === 'pending' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-amber-800">📅 {req.clients?.name}</p>
                {req.status === 'pending'
                  ? <button onClick={() => markRequestSeen(req.id)} className="text-xs font-bold bg-amber-200 text-amber-800 px-2.5 py-1 rounded-lg active:scale-95">✓ Vu</button>
                  : <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Vu ✓</span>
                }
              </div>
              <p className="text-sm text-slate-600">
                {[req.petit_kits > 0 && `${req.petit_kits} petit${req.petit_kits > 1 ? 's' : ''}`, req.grand_kits > 0 && `${req.grand_kits} grand${req.grand_kits > 1 ? 's' : ''}`].filter(Boolean).join(' + ')}
                {req.notes ? ` — ${req.notes}` : ''}
              </p>
            </div>
          ))}

          {dayDeliveries.length === 0 && dayRequests.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-4xl mb-2">{isFuture ? '📅' : '📭'}</p>
              <p className="text-sm">{isFuture ? 'Aucune prévision pour ce jour.' : 'Aucune livraison ce jour-là.'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
