import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function exportPDF(client, month, deliveries) {
  const doc = new jsPDF()
  const monthLabel = new Date(`${month}-15`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const dateGen = new Date().toLocaleDateString('fr-FR')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Laverie Belle Vie — Récapitulatif mensuel', 14, 20)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Client : ${client.name}`, 14, 30)
  doc.text(`Période : ${monthLabel}`, 14, 37)
  doc.text(`Généré le : ${dateGen}`, 14, 44)

  if (client.type === 'conciergerie') {
    const totals = deliveries.reduce(
      (acc, d) => ({
        petitKits: acc.petitKits + (d.petit_kits || 0),
        grandKits: acc.grandKits + (d.grand_kits || 0),
        weight: acc.weight + (parseFloat(d.total_weight) || 0),
      }),
      { petitKits: 0, grandKits: 0, weight: 0 }
    )

    doc.setFont('helvetica', 'bold')
    doc.text('Totaux du mois', 14, 56)
    autoTable(doc, {
      startY: 60,
      head: [['Petits kits', 'Grands kits', 'Poids total (kg)']],
      body: [[totals.petitKits, totals.grandKits, totals.weight.toFixed(2)]],
      styles: { halign: 'center' },
      headStyles: { fillColor: [37, 99, 235] },
    })

    doc.setFont('helvetica', 'bold')
    doc.text('Détail des livraisons', 14, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Date', 'Petits kits', 'Grands kits', 'Poids (kg)', 'Notes']],
      body: deliveries.map(d => [
        new Date(d.delivery_date + 'T12:00:00').toLocaleDateString('fr-FR'),
        d.petit_kits || 0,
        d.grand_kits || 0,
        d.total_weight || '—',
        d.notes || '',
      ]),
      headStyles: { fillColor: [71, 85, 105] },
    })
  } else {
    // Résidence : total + par résident
    const byResident = {}
    deliveries.forEach(d => {
      d.delivery_items?.forEach(item => {
        const rName = item.residents?.name || 'Non assigné'
        if (!byResident[rName]) byResident[rName] = {}
        const aName = item.articles?.name || '?'
        byResident[rName][aName] = (byResident[rName][aName] || 0) + item.quantity
      })
    })
    const overallTotals = {}
    Object.values(byResident).forEach(articles => {
      Object.entries(articles).forEach(([name, qty]) => {
        overallTotals[name] = (overallTotals[name] || 0) + qty
      })
    })

    doc.setFont('helvetica', 'bold')
    doc.text('Total résidence', 14, 56)
    autoTable(doc, {
      startY: 60,
      head: [['Article', 'Quantité totale']],
      body: Object.entries(overallTotals).map(([name, qty]) => [name, qty]),
      headStyles: { fillColor: [37, 99, 235] },
    })

    let y = doc.lastAutoTable.finalY + 12
    for (const [resident, articles] of Object.entries(byResident).sort(([a], [b]) => a.localeCompare(b))) {
      if (y > 240) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold')
      doc.text(resident, 14, y)
      autoTable(doc, {
        startY: y + 4,
        head: [['Article', 'Quantité']],
        body: Object.entries(articles).map(([name, qty]) => [name, qty]),
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14 },
      })
      y = doc.lastAutoTable.finalY + 10
    }
  }

  doc.save(`LBV_recap_${client.name.replace(/\s+/g, '_')}_${month}.pdf`)
}

function MonthSelector({ value, onChange }) {
  const months = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    months.push({ val, label })
  }
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
    </select>
  )
}

// ─── Récap Conciergerie ────────────────────────────────────────────────────────
function ConciergerieRecap({ deliveries }) {
  const totals = deliveries.reduce(
    (acc, d) => ({
      petitKits: acc.petitKits + (d.petit_kits || 0),
      grandKits: acc.grandKits + (d.grand_kits || 0),
      weight: acc.weight + (parseFloat(d.total_weight) || 0),
    }),
    { petitKits: 0, grandKits: 0, weight: 0 }
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100">
          <div className="text-2xl font-bold text-blue-600">{totals.petitKits}</div>
          <div className="text-xs text-slate-500 mt-1 font-semibold">Petits kits</div>
        </div>
        <div className="bg-purple-50 rounded-2xl p-4 text-center border border-purple-100">
          <div className="text-2xl font-bold text-purple-600">{totals.grandKits}</div>
          <div className="text-xs text-slate-500 mt-1 font-semibold">Grands kits</div>
        </div>
        <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-100">
          <div className="text-2xl font-bold text-green-600">{totals.weight.toFixed(1)}</div>
          <div className="text-xs text-slate-500 mt-1 font-semibold">kg total</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <p className="font-bold text-sm text-slate-700">Détail des livraisons ({deliveries.length})</p>
        </div>
        {deliveries.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">Aucune livraison ce mois-ci.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {deliveries.map(d => (
              <div key={d.id} className="px-4 py-3 flex items-center justify-between">
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
                  </p>
                </div>
                <span className="font-bold text-slate-900">{d.total_weight} kg</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Récap Résidence ───────────────────────────────────────────────────────────
function ResidenceRecap({ deliveries }) {
  const byResident = {}
  deliveries.forEach(d => {
    d.delivery_items?.forEach(item => {
      const rName = item.residents?.name || 'Non assigné'
      if (!byResident[rName]) byResident[rName] = {}
      const aName = item.articles?.name || '?'
      byResident[rName][aName] = (byResident[rName][aName] || 0) + item.quantity
    })
  })

  const overallTotals = {}
  Object.values(byResident).forEach(articles => {
    Object.entries(articles).forEach(([name, qty]) => {
      overallTotals[name] = (overallTotals[name] || 0) + qty
    })
  })

  const hasData = Object.keys(overallTotals).length > 0

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <p className="font-bold text-sm">Total résidence</p>
          <p className="text-xs text-slate-400">{deliveries.length} livraison{deliveries.length > 1 ? 's' : ''}</p>
        </div>
        {!hasData ? (
          <p className="text-center text-slate-400 py-8 text-sm">Aucune livraison ce mois-ci.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {Object.entries(overallTotals).map(([name, qty]) => (
              <div key={name} className="px-4 py-3 flex justify-between">
                <span className="text-sm text-slate-700">{name}</span>
                <span className="font-bold text-slate-900">×{qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {hasData && (
        <>
          <p className="font-bold text-slate-700 text-sm">Par résident</p>
          {Object.entries(byResident)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([resident, articles]) => (
              <div key={resident} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                  <p className="font-bold text-sm text-blue-800">{resident}</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {Object.entries(articles).map(([name, qty]) => (
                    <div key={name} className="px-4 py-2.5 flex justify-between">
                      <span className="text-sm text-slate-600">{name}</span>
                      <span className="font-semibold text-slate-900">×{qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function Monthly() {
  const now = new Date()
  const [month, setMonth] = useState(now.toISOString().slice(0, 7))
  const [clients, setClients] = useState([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      if (data) {
        setClients(data)
        if (data.length > 0) setSelectedClientId(data[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedClientId || !month) return
    setLoading(true)
    const [year, mon] = month.split('-')
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate()
    const start = `${month}-01`
    const end = `${month}-${String(lastDay).padStart(2, '0')}`

    supabase
      .from('deliveries')
      .select('*, delivery_items(*, articles(*), residents(*))')
      .eq('client_id', selectedClientId)
      .gte('delivery_date', start)
      .lte('delivery_date', end)
      .order('delivery_date')
      .then(({ data }) => {
        setDeliveries(data || [])
        setLoading(false)
      })
  }, [selectedClientId, month])

  const selectedClient = clients.find(c => c.id === selectedClientId)

  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Récap mensuel</h2>

      <div className="space-y-3 mb-6">
        <MonthSelector value={month} onChange={setMonth} />
        <select
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!loading && deliveries.length > 0 && (
        <button
          onClick={() => exportPDF(selectedClient, month, deliveries)}
          className="w-full mb-4 border-2 border-blue-600 text-blue-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 active:scale-95 transition-all"
        >
          📄 Exporter en PDF
        </button>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : selectedClient?.type === 'conciergerie' ? (
        <ConciergerieRecap deliveries={deliveries} />
      ) : (
        <ResidenceRecap deliveries={deliveries} />
      )}
    </div>
  )
}
