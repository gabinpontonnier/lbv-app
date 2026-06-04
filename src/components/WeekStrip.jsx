export default function WeekStrip({ days, selected, onSelect, meta = {}, onPrev, onNext, canNext = false }) {
  const todayISO = new Date().toISOString().slice(0, 10)
  const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

  return (
    <div className="flex items-center gap-1">
      <button onClick={onPrev} className="w-7 h-full flex items-center justify-center text-slate-400 font-bold text-xl shrink-0 active:scale-90">‹</button>
      <div className="flex-1 flex gap-1.5">
        {days.map(day => {
          const d = new Date(day + 'T12:00:00')
          const letter = DAY_LETTERS[d.getDay()]
          const num = d.getDate()
          const isToday = day === todayISO
          const isSelected = day === selected
          const isPast = day < todayISO
          const { deliveries = 0, requests = 0, checkins = 0 } = meta[day] || {}

          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              className={`flex-1 flex flex-col items-center py-2 rounded-2xl transition-all active:scale-95 select-none
                ${isSelected
                  ? isToday ? 'bg-blue-600 shadow-md shadow-blue-200' : 'bg-slate-800'
                  : isToday ? 'bg-blue-50 border-2 border-blue-300'
                  : isPast ? 'bg-slate-50' : 'bg-white border border-slate-100'
                }`}
            >
              <span className={`text-xs font-semibold leading-none mb-0.5 ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>{letter}</span>
              <span className={`text-base font-bold leading-tight ${isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-slate-800'}`}>{num}</span>
              <div className="flex gap-0.5 mt-1 h-2 items-center justify-center">
                {deliveries > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : 'bg-blue-500'}`} />
                )}
                {requests > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-400'}`} />
                )}
                {checkins > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-green-200' : 'bg-green-500'}`} />
                )}
                {deliveries === 0 && requests === 0 && checkins === 0 && <span className="w-1.5 h-1.5" />}
              </div>
            </button>
          )
        })}
      </div>
      <button onClick={onNext} disabled={!canNext} className="w-7 h-full flex items-center justify-center text-slate-400 font-bold text-xl shrink-0 active:scale-90 disabled:opacity-20">›</button>
    </div>
  )
}
