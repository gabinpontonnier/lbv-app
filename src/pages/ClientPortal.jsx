import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  const todayISO = now.toISOString().slice(0, 10)
  const [month, setMonth] = useState(now.toISOString().slice(0, 7))
  const [deliveries, setDeliveries] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  // Demande
  const [reqDate, setReqDate] = useState('')
  const [reqPetit, setReqPetit] = useState(0)
  const [reqGrand, setReqGrand] = useState(0)
  const [reqNotes, setReqNotes] = useState('')
  const [reqSaving, setReqSaving] = useState(false)
  const [reqSuccess, setReqSuccess] = useState(false)
  const [myRequests, setMyRequests] = useState([])

  // Dernières livraisons (5)
  useEffect(() => {
    supabase
      .from('deliveries')
      .select('*')
      .eq('client_id', clientId)
      .order('delivery_date', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent(data || []))
    supabase
      .from('delivery_requests')
      .select('*')
      .eq('client_id', clientId)
      .gte('requested_date', todayISO)
      .order('requested_date')
      .then(({ data }) => setMyRequests(data || []))
  }, [clientId])

  // Livraisons du mois sélectionné
  useEffect(() => {
    setLoading(true)
    const lastDay = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate()
    supabase
      .from('deliveries')
      .select('*')
      .eq('client_id', clientId)
      .gte('delivery_date', `${month}-01`)
      .lte('delivery_date', `${month}-${String(lastDay).padStart(2, '0')}`)
      .order('delivery_date')
      .then(({ data }) => {
        setDeliveries(data || [])
        setLoading(false)
      })
  }, [clientId, month])

  const totals = deliveries.reduce(
    (acc, d) => ({
      petitKits: acc.petitKits + (d.petit_kits || 0),
      grandKits: acc.grandKits + (d.grand_kits || 0),
      weight: acc.weight + (parseFloat(d.total_weight) || 0),
    }),
    { petitKits: 0, grandKits: 0, weight: 0 }
  )

  const confirmReceipt = async (id) => {
    await supabase.from('deliveries').update({ status: 'confirmed' }).eq('id', id)
    setRecent(prev => prev.map(d => d.id === id ? { ...d, status: 'confirmed' } : d))
  }

  const sendRequest = async (e) => {
    e.preventDefault()
    if (!reqDate || (reqPetit === 0 && reqGrand === 0)) return
    setReqSaving(true)
    const { data, error } = await supabase.from('delivery_requests').insert({
      client_id: clientId,
      requested_date: reqDate,
      petit_kits: reqPetit,
      grand_kits: reqGrand,
      notes: reqNotes.trim() || null,
    }).select().single()
    if (!error && data) {
      setMyRequests(prev => [...prev, data].sort((a, b) => a.requested_date.localeCompare(b.requested_date)))
      setReqDate('')
      setReqPetit(0)
      setReqGrand(0)
      setReqNotes('')
      setReqSuccess(true)
      setTimeout(() => setReqSuccess(false), 3000)
    }
    setReqSaving(false)
  }

  const months = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      val: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-5 pt-10 pb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Laverie Belle Vie</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-blue-200 font-semibold"
          >
            Déconnexion
          </button>
        </div>
        <h1 className="text-2xl font-bold">Mon espace</h1>
        <p className="text-blue-200 text-sm mt-1">Conciergerie</p>
      </div>

      <div className="px-4 py-5 space-y-5">

        {/* Dernières livraisons */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="font-bold text-slate-800">Dernières livraisons</p>
          </div>
          {recent.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">Aucune livraison enregistrée.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {recent.map(d => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-800 capitalize">
                        {new Date(d.delivery_date + 'T12:00:00').toLocaleDateString('fr-FR', {
                          weekday: 'short', day: 'numeric', month: 'short'
                        })}
                      </p>
                      <p className="text-xs text-slate-400">
                        {[
                          d.petit_kits > 0 && `${d.petit_kits} petit${d.petit_kits > 1 ? 's' : ''}`,
                          d.grand_kits > 0 && `${d.grand_kits} grand${d.grand_kits > 1 ? 's' : ''}`,
                        ].filter(Boolean).join(' + ')}
                        {d.total_weight ? ` — ${d.total_weight} kg` : ''}
                      </p>
                    </div>
                    {d.status === 'confirmed' ? (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">✓ Reçu</span>
                    ) : (
                      <button
                        onClick={() => confirmReceipt(d.id)}
                        className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full active:scale-95 transition-all"
                      >
                        Confirmer réception
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Récap mensuel */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
            <p className="font-bold text-slate-800">Récap mensuel</p>
          </div>

          <div className="px-4 pt-3 pb-2">
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : deliveries.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Aucune livraison ce mois-ci.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 px-4 py-3">
                <div className="bg-blue-50 rounded-2xl p-3 text-center border border-blue-100">
                  <div className="text-xl font-bold text-blue-600">{totals.petitKits}</div>
                  <div className="text-xs text-slate-500 font-semibold mt-0.5">Petits kits</div>
                </div>
                <div className="bg-purple-50 rounded-2xl p-3 text-center border border-purple-100">
                  <div className="text-xl font-bold text-purple-600">{totals.grandKits}</div>
                  <div className="text-xs text-slate-500 font-semibold mt-0.5">Grands kits</div>
                </div>
                <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
                  <div className="text-xl font-bold text-green-600">{totals.weight.toFixed(1)}</div>
                  <div className="text-xs text-slate-500 font-semibold mt-0.5">kg total</div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <button
                  onClick={() => exportPDF(month, deliveries)}
                  className="w-full border-2 border-blue-600 text-blue-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  📄 Télécharger le récap PDF
                </button>
              </div>
            </>
          )}
        </div>

        {/* Demandes / prévisions */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="font-bold text-slate-800">📅 Prévenir d'un besoin</p>
            <p className="text-xs text-slate-400 mt-0.5">Indiquez un prochain besoin en linge pour qu'on s'organise</p>
          </div>

          {/* Mes demandes en attente */}
          {myRequests.length > 0 && (
            <div className="divide-y divide-slate-50">
              {myRequests.map(r => (
                <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 capitalize">
                      {new Date(r.requested_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-slate-400">
                      {[r.petit_kits > 0 && `${r.petit_kits} petit${r.petit_kits > 1 ? 's' : ''}`, r.grand_kits > 0 && `${r.grand_kits} grand${r.grand_kits > 1 ? 's' : ''}`].filter(Boolean).join(' + ')}
                      {r.notes ? ` — ${r.notes}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === 'seen' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {r.status === 'seen' ? '✓ Vu' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={sendRequest} className="px-4 py-4 space-y-3 border-t border-slate-50">
            <input
              type="date"
              value={reqDate}
              min={todayISO}
              onChange={e => setReqDate(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 font-semibold mb-2">Petits kits</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setReqPetit(p => Math.max(0, p - 1))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">-</button>
                  <span className="font-bold text-slate-900 w-6 text-center">{reqPetit}</span>
                  <button type="button" onClick={() => setReqPetit(p => p + 1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold text-blue-600">+</button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 font-semibold mb-2">Grands kits</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setReqGrand(p => Math.max(0, p - 1))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">-</button>
                  <span className="font-bold text-slate-900 w-6 text-center">{reqGrand}</span>
                  <button type="button" onClick={() => setReqGrand(p => p + 1)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold text-blue-600">+</button>
                </div>
              </div>
            </div>
            <input
              value={reqNotes}
              onChange={e => setReqNotes(e.target.value)}
              placeholder="Note (ex: semaine chargée, besoin urgent...)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {reqSuccess && <p className="text-green-600 text-sm font-bold text-center">✓ Demande envoyée !</p>}
            <button
              type="submit"
              disabled={reqSaving || !reqDate || (reqPetit === 0 && reqGrand === 0)}
              className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold disabled:opacity-40 active:scale-95 transition-all"
            >
              {reqSaving ? 'Envoi...' : 'Envoyer la prévision'}
            </button>
          </form>
        </div>

        {/* Contact */}
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <p className="font-bold text-blue-800 text-sm mb-1">📞 Contact</p>
          <p className="text-sm text-slate-600">Pour toute question, contactez-nous :</p>
          <a href="tel:+33000000000" className="text-blue-600 font-semibold text-sm">contact@laveriebellevie.fr</a>
        </div>

      </div>
    </div>
  )
}
