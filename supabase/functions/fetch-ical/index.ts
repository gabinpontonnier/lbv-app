const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { ical_url } = await req.json()
    if (!ical_url) throw new Error('ical_url requis')

    const res = await fetch(ical_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LBV-App/1.0)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} lors de la récupération du calendrier`)

    const text = await res.text()
    const events = parseIcal(text)

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function parseDate(val: string): string | null {
  const s = (val || '').trim().split('T')[0].replace(/Z$/, '')
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function parseIcal(text: string) {
  // Dépliage des lignes iCal (continuation lines)
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
  const lines = unfolded.split(/\r\n|\n|\r/)

  const events: { uid: string; checkin: string; checkout: string; summary: string }[] = []
  let current: Record<string, string> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT' && current) {
      const uid = current['UID'] || crypto.randomUUID()
      // Extraire valeur après le premier ':'
      const getVal = (k: string) => {
        const v = current![k]
        if (!v) return null
        const idx = v.indexOf(':')
        return idx >= 0 ? v.slice(idx + 1) : v
      }
      const rawStart = getVal('DTSTART') || current!['DTSTART'] || ''
      const rawEnd = getVal('DTEND') || current!['DTEND'] || ''
      const checkin = parseDate(rawStart)
      const checkout = parseDate(rawEnd)
      const summary = current['SUMMARY'] || ''

      if (checkin && checkout) {
        events.push({ uid, checkin, checkout, summary })
      }
      current = null
    } else if (current) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        // Clé = tout avant le premier ':', en ignorant les paramètres (;TYPE=...)
        const key = line.slice(0, colonIdx).split(';')[0]
        current[key] = line.slice(colonIdx + 1)
      }
    }
  }

  return events
}
