import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import WeekStrip from '../components/WeekStrip'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TODAY = new Date().toISOString().slice(0, 10)

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
function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => shiftDate(start, i))
}
function formatDay(iso) {
  if (iso === TODAY) return "Aujourd'hui"
  if (iso === shiftDate(TODAY, -1)) return 'Hier'
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function exportPDF(month, deliveries) {
  const doc = new jsPDF()
  const monthLabel = new Date(`${month}-15`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Laverie Belle Vie — Récapitulatif mensuel', 14, 20)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Période : ${monthLabel}`, 14, 32)
  doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 39)

  const totals = deliveries.reduce(
    (acc, d) => ({
      petitKits: acc.petitKits + (d.petit_kits || 0),
      grandKits: acc.grandKits + (d.grand_kits || 0),
      weight: acc.weight + (parseFloat(d.total_weight) || 0),
    }),
    { petitKits: 0, grandKits: 0, weight: 0 }
  )

  autoTable(doc, {
    startY: 48,
    head: [['Petits kits', 'Grands kits', 'Poids total (kg)']],
    body: [[totals.petitKits, totals.grandKits, totals.weight.toFixed(2)]],
    styles: { halign: 'center' },
    headStyles: { fillColor: [37, 99, 235] },
  })

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Date', 'Petits kits', 'Grands kits', 'Poids (kg)']],
    body: deliveries.map(d => [
      new Date(d.delivery_date + 'T12:00:00').toLocaleDateString('fr-FR'),
      d.petit_kits || 0,
      d.grand_kits || 0,
      d.total_weight || '—',
    ]),
    headStyles: { fillColor: [71, 85, 105] },
  })

  doc.save(`LBV_conciergerie_${month}.pdf`)
}

export default function ClientPortal({ clientId }) {
  const now = new Date()
  const [weekBase, setWeekBase] = useState(weekStart(TODAY))
  const [selectedDay, setSelectedDay] = useState(TODAY)
  const [weekData, setWeekData] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingReq, setEditingReq] = useState(null)
  const [savingReq, setSavingReq] = useState(false)

  // iCal
  const [icalUrl, setIcalUrl] = useState('')
  const [icalSaving, setIcalSaving] = useState(false)
  const [icalSyncing, setIcalSyncing] = useState(false)
  const [icalMsg, setIcalMsg] = useState(null) // { type: 'ok'|'err', text }
  const [clientData, setClientData] = useState(null)

  // Récap mensuel
  const [month, setMonth] = useState(now.toISOString().slice(0, 7))
  const [monthDeliveries, setMonthDeliveries] = useState([])
  const [monthLoading, setMonthLoading] = useState(false)

  const days = weekDays(weekBase)

  useEffect(() => {
    supabase.from('clients').select('*').eq('id', clientId).single().then(({ data }) => {
      if (data) { setClientData(data); setIcalUrl(data.ical_url || '') }
    })
  }, [clientId])

  const loadWeek = useCallback(async (start) => {
    setLoading(true)
    const d = weekDays(start)
    const [{ data: dels }, { data: reqs }, { data: ckins }] = await Promise.all([
      supabase.from('deliveries').select('*').eq('client_id', clientId).gte('delivery_date', d[0]).lte('delivery_date', d[6]).order('delivery_date'),
      supabase.from('delivery_requests').select('*').eq('client_id', clientId).gte('requested_date', d[0]).lte('requested_date', d[6]).order('requested_date'),
      supabase.from('ical_events').select('*').eq('client_id', clientId).gte('checkin_date', d[0]).lte('checkin_date', d[6]).order('checkin_date'),
    ])
    const grouped = {}
    d.forEach(day => { grouped[day] = { deliveries: [], requests: [], checkins: [] } })
    ;(dels || []).forEach(del => { if (grouped[del.delivery_date]) grouped[del.delivery_date].deliveries.push(del) })
    ;(reqs || []).forEach(req => { if (grouped[req.requested_date]) grouped[req.requested_date].requests.push(req) })
    ;(ckins || []).forEach(ev => { if (grouped[ev.checkin_date]) grouped[ev.checkin_date].checkins.push(ev) })
    setWeekData(grouped)
    setLoading(false)
  }, [clientId])

  useEffect(() => { loadWeek(weekBase) }, [weekBase, loadWeek])

  useEffect(() => {
    setMonthLoading(true)
    const lastDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate()
    supabase.from('deliveries').select('*').eq('client_id', clientId)
      .gte('delivery_date', `${month}-01`).lte('delivery_date', `${month}-${String(lastDay).padStart(2, '0')}`)
      .order('delivery_date')
      .then(({ data }) => { setMonthDeliveries(data || []); setMonthLoading(false) })
  }, [clientId, month])

  const handlePrevWeek = () => { const nb = shiftDate(weekBase, -7); setWeekBase(nb); setSelectedDay(nb); setEditingReq(null) }
  const handleNextWeek = () => { const nb = shiftDate(weekBase, 7); setWeekBase(nb); setSelectedDay(nb); setEditingReq(null) }
  const handleSelectDay = (day) => { setSelectedDay(day); setEditingReq(null) }

  const saveIcalUrl = async () => {
    setIcalSaving(true)
    await supabase.from('clients').update({ ical_url: icalUrl.trim() || null }).eq('id', clientId)
    setClientData(prev => ({ ...prev, ical_url: icalUrl.trim() || null }))
    setIcalMsg({ type: 'ok', text: 'URL sauvegardée' })
    setTimeout(() => setIcalMsg(null), 3000)
    setIcalSaving(false)
  }

  const syncIcal = async () => {
    if (!icalUrl.trim()) return
    setIcalSyncing(true)
    setIcalMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ical', { body: { ical_url: icalUrl.trim() } })
      if (error || data?.error) throw new Error(data?.error || error.message)
      const events = data.events || []
      if (events.length > 0) {
        const rows = events.map(e => ({ client_id: clientId, uid: e.uid, checkin_date: e.checkin, checkout_date: e.checkout, summary: e.summary, synced_at: new Date().toISOString() }))
        await supabase.from('ical_events').upsert(rows, { onConflict: 'client_id,uid' })
      }
      await loadWeek(weekBase)
      setIcalMsg({ type: 'ok', text: `✓ ${events.length} séjour${events.length > 1 ? 's' : ''} importé${events.length > 1 ? 's' : ''}` })
    } catch (e) {
      setIcalMsg({ type: 'err', text: `Erreur : ${e.message}` })
    }
    setTimeout(() => setIcalMsg(null), 5000)
    setIcalSyncing(false)
  }

  const confirmReceipt = async (id) => {
    await supabase.from('deliveries').update({ status: 'confirmed' }).eq('id', id)
    setWeekData(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = { ...next[k], deliveries: next[k].deliveries.map(d => d.id === id ? { ...d, status: 'confirmed' } : d) } })
      return next
    })
  }

  const saveRequest = async () => {
    if (!editingReq || (editingReq.petit_kits === 0 && editingReq.grand_kits === 0)) return
    setSavingReq(true)
    if (editingReq.id) {
      const { data } = await supabase.from('delivery_requests').update({ petit_kits: editingReq.petit_kits, grand_kits: editingReq.grand_kits, notes: editingReq.notes || null }).eq('id', editingReq.id).select().single()
      if (data) {
        setWeekData(prev => { const next = { ...prev }; if (next[selectedDay]) next[selectedDay] = { ...next[selectedDay], requests: next[selectedDay].requests.map(r => r.id === data.id ? data : r) }; return next })
      }
    } else {
      const { data } = await supabase.from('delivery_requests').insert({ client_id: clientId, requested_date: selectedDay, petit_kits: editingReq.petit_kits, grand_kits: editingReq.grand_kits, notes: editingReq.notes || null }).select().single()
      if (data) {
        setWeekData(prev => { const next = { ...prev }; if (next[selectedDay]) next[selectedDay] = { ...next[selectedDay], requests: [...next[selectedDay].requests, data] }; return next })
      }
    }
    setEditingReq(null)
    setSavingReq(false)
  }

  const deleteRequest = async (id) => {
    if (!confirm('Supprimer cette prévision ?')) return
    await supabase.from('delivery_requests').delete().eq('id', id)
    setWeekData(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = { ...next[k], requests: next[k].requests.filter(r => r.id !== id) } })
      return next
    })
  }

  const stripMeta = {}
  days.forEach(day => {
    const d = weekData[day]
    if (d) stripMeta[day] = { deliveries: d.deliveries.length, requests: d.requests.length, checkins: d.checkins.length }
  })

  const isFuture = selectedDay > TODAY
  const isPast = selectedDay <= TODAY
  const dayDeliveries = weekData[selectedDay]?.deliveries || []
  const dayRequests = weekData[selectedDay]?.requests || []
  const dayCheckins = weekData[selectedDay]?.checkins || []
  const existingReq = dayRequests[0] || null

  const monthTotals = monthDeliveries.reduce((acc, d) => ({ petit: acc.petit + (d.petit_kits || 0), grand: acc.grand + (d.grand_kits || 0), kg: acc.kg + (parseFloat(d.total_weight) || 0) }), { petit: 0, grand: 0, kg: 0 })
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return { val: d.toISOString().slice(0, 7), label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) } })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-5 pt-10 pb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Laverie Belle Vie</p>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-blue-200 font-semibold">Déconnexion</button>
        </div>
        <h1 className="text-xl font-bold">Mon espace conciergerie</h1>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* WeekStrip horizontal */}
        <div className="bg-white rounded-2xl border border-slate-100 px-2 py-3 shadow-sm">
          <WeekStrip days={days} selected={selectedDay} onSelect={handleSelectDay} meta={stripMeta} onPrev={handlePrevWeek} onNext={handleNextWeek} canNext={true} />
        </div>

        {/* Détail du jour sélectionné */}
        <div>
          <h3 className="font-bold text-slate-700 text-sm capitalize mb-3">{formatDay(selectedDay)}</h3>

          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {/* Passé/aujourd'hui : livraisons reçues */}
              {isPast && dayDeliveries.map(d => (
                <div key={d.id} className={`bg-white rounded-2xl p-4 border ${d.status === 'confirmed' ? 'border-green-200' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">
                        {[d.petit_kits > 0 && `${d.petit_kits} petit${d.petit_kits > 1 ? 's' : ''}`, d.grand_kits > 0 && `${d.grand_kits} grand${d.grand_kits > 1 ? 's' : ''}`].filter(Boolean).join(' + ')}
                      </p>
                      {d.total_weight && <p className="text-xs text-blue-600 font-semibold mt-0.5">⚖️ {d.total_weight} kg</p>}
                    </div>
                    {d.status === 'confirmed'
                      ? <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">✓ Reçu</span>
                      : <button onClick={() => confirmReceipt(d.id)} className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl active:scale-95">Confirmer réception</button>
                    }
                  </div>
                </div>
              ))}

              {/* Futur : gestion de la demande */}
              {isFuture && !editingReq && existingReq && (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-bold text-sm text-amber-800">📅 Prévision envoyée</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${existingReq.status === 'seen' ? 'bg-green-100 text-green-600' : 'bg-amber-200 text-amber-700'}`}>
                      {existingReq.status === 'seen' ? 'Vu ✓' : 'En attente'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">
                    {[existingReq.petit_kits > 0 && `${existingReq.petit_kits} petit${existingReq.petit_kits > 1 ? 's' : ''}`, existingReq.grand_kits > 0 && `${existingReq.grand_kits} grand${existingReq.grand_kits > 1 ? 's' : ''}`].filter(Boolean).join(' + ')}
                    {existingReq.notes ? ` — ${existingReq.notes}` : ''}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingReq({ id: existingReq.id, petit_kits: existingReq.petit_kits, grand_kits: existingReq.grand_kits, notes: existingReq.notes || '' })} className="flex-1 py-2 rounded-xl bg-white border border-amber-300 text-amber-800 font-bold text-sm active:scale-95">✏️ Modifier</button>
                    <button onClick={() => deleteRequest(existingReq.id)} className="py-2 px-4 rounded-xl bg-white border border-red-200 text-red-400 font-bold text-sm active:scale-95">🗑</button>
                  </div>
                </div>
              )}

              {isFuture && !editingReq && !existingReq && (
                <button onClick={() => setEditingReq({ petit_kits: 0, grand_kits: 0, notes: '' })} className="w-full py-4 rounded-2xl border-2 border-dashed border-blue-200 text-blue-500 font-bold text-sm active:scale-95">
                  + Ajouter une prévision pour ce jour
                </button>
              )}

              {editingReq && (
                <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3">
                  <p className="font-bold text-sm text-slate-800">{editingReq.id ? 'Modifier' : 'Nouvelle prévision'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[['Petits kits', 'petit_kits'], ['Grands kits', 'grand_kits']].map(([label, key]) => (
                      <div key={key} className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-500 font-semibold mb-2">{label}</p>
                        <div className="flex items-center justify-between">
                          <button type="button" onClick={() => setEditingReq(e => ({ ...e, [key]: Math.max(0, e[key] - 1) }))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold">-</button>
                          <span className="font-bold text-slate-900">{editingReq[key]}</span>
                          <button type="button" onClick={() => setEditingReq(e => ({ ...e, [key]: e[key] + 1 }))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold text-blue-600">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <input value={editingReq.notes} onChange={e => setEditingReq(p => ({ ...p, notes: e.target.value }))} placeholder="Note optionnelle" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingReq(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm">Annuler</button>
                    <button onClick={saveRequest} disabled={savingReq || (editingReq.petit_kits === 0 && editingReq.grand_kits === 0)} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95">
                      {savingReq ? '...' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              )}

              {/* Check-ins iCal (visible sur tous les jours) */}
              {dayCheckins.length > 0 && (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
                  <p className="font-bold text-sm text-green-800 mb-2">✈️ {dayCheckins.length} check-in{dayCheckins.length > 1 ? 's' : ''} ce jour</p>
                  <div className="space-y-1 mb-3">
                    {dayCheckins.map(ev => (
                      <p key={ev.id} className="text-xs text-slate-600">
                        → {ev.summary || 'Réservation'}
                        <span className="text-slate-400"> · jusqu'au {new Date(ev.checkout_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                      </p>
                    ))}
                  </div>
                  {isFuture && !existingReq && !editingReq && (
                    <button
                      onClick={() => setEditingReq({ petit_kits: clientData?.default_petit_kits ?? 1, grand_kits: clientData?.default_grand_kits ?? 0, notes: '' })}
                      className="w-full py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm active:scale-95"
                    >
                      📦 Créer une demande de linge ({clientData?.default_petit_kits ?? 1} petit{(clientData?.default_petit_kits ?? 1) > 1 ? 's' : ''})
                    </button>
                  )}
                </div>
              )}

              {dayDeliveries.length === 0 && dayCheckins.length === 0 && !isFuture && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm">Aucune livraison ce jour-là.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Récap mensuel */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
            <p className="font-bold text-slate-800">Récap mensuel</p>
          </div>
          <div className="px-4 pt-3 pb-2">
            <select value={month} onChange={e => setMonth(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
          </div>
          {monthLoading ? (
            <div className="flex justify-center py-6"><div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : monthDeliveries.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">Aucune livraison ce mois-ci.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 px-4 py-3">
                <div className="bg-blue-50 rounded-2xl p-3 text-center"><div className="text-xl font-bold text-blue-600">{monthTotals.petit}</div><div className="text-xs text-slate-500 font-semibold mt-0.5">Petits kits</div></div>
                <div className="bg-purple-50 rounded-2xl p-3 text-center"><div className="text-xl font-bold text-purple-600">{monthTotals.grand}</div><div className="text-xs text-slate-500 font-semibold mt-0.5">Grands kits</div></div>
                <div className="bg-green-50 rounded-2xl p-3 text-center"><div className="text-xl font-bold text-green-600">{monthTotals.kg.toFixed(1)}</div><div className="text-xs text-slate-500 font-semibold mt-0.5">kg total</div></div>
              </div>
              <div className="px-4 pb-4">
                <button onClick={() => exportPDF(month, monthDeliveries)} className="w-full border-2 border-blue-600 text-blue-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95">
                  📄 Télécharger le récap PDF
                </button>
              </div>
            </>
          )}
        </div>

        {/* Section iCal Sync */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="font-bold text-slate-800">🔗 Calendrier Airbnb / Booking</p>
            <p className="text-xs text-slate-400 mt-0.5">Importez vos réservations pour anticiper vos besoins en linge</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="flex gap-2">
              <input
                value={icalUrl}
                onChange={e => setIcalUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/...ics"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={saveIcalUrl} disabled={icalSaving} className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs disabled:opacity-40 active:scale-95 shrink-0">
                {icalSaving ? '...' : '💾'}
              </button>
            </div>
            <button
              onClick={syncIcal}
              disabled={icalSyncing || !icalUrl.trim()}
              className="w-full py-3 rounded-2xl bg-green-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2"
            >
              {icalSyncing ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🔄'}
              {icalSyncing ? 'Synchronisation...' : 'Synchroniser le calendrier'}
            </button>
            {icalMsg && (
              <p className={`text-sm font-bold text-center ${icalMsg.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{icalMsg.text}</p>
            )}
            <p className="text-xs text-slate-400">Airbnb → Calendrier → Exporter → Copier l'URL iCal</p>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <p className="font-bold text-blue-800 text-sm mb-1">📞 Contact</p>
          <a href="mailto:contact@laveriebellevie.fr" className="text-blue-600 font-semibold text-sm">contact@laveriebellevie.fr</a>
        </div>

      </div>
    </div>
  )
}
