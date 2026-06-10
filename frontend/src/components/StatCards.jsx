function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value || 0)
}

function StatCards({ stats, sentimentSummary, activeMetric, onSelectMetric }) {
  const cards = [
    {
      key: 'total_posts',
      label: 'Posts tracked',
      value: formatNumber(stats?.total_posts),
      note: 'Published records in the selected page',
      tone: 'blue',
    },
    {
      key: 'total_comments',
      label: 'Comments classified',
      value: formatNumber(stats?.total_comments),
      note: 'Audience comments scored for sentiment',
      tone: 'green',
    },
    {
      key: 'total_likes',
      label: 'Engagement likes',
      value: formatNumber(stats?.total_likes),
      note: 'Total likes across fetched posts',
      tone: 'amber',
    },
    {
      key: 'total_shares',
      label: 'Share actions',
      value: formatNumber(stats?.total_shares),
      note: 'Reposts from the selected page feed',
      tone: 'slate',
    },
    {
      key: 'positive_pct',
      label: 'Positive sentiment',
      value: `${Math.round(sentimentSummary?.positive_pct || 0)}%`,
      note: `${sentimentSummary?.positive || 0} positive comments`,
      tone: 'green',
    },
    {
      key: 'negative_pct',
      label: 'Negative sentiment',
      value: `${Math.round(sentimentSummary?.negative_pct || 0)}%`,
      note: `${sentimentSummary?.negative || 0} negative comments`,
      tone: 'rose',
    },
  ]

  const toneClasses = {
    blue: 'border-t-blue-500 text-blue-700 bg-blue-50',
    green: 'border-t-emerald-500 text-emerald-700 bg-emerald-50',
    amber: 'border-t-amber-500 text-amber-700 bg-amber-50',
    rose: 'border-t-rose-500 text-rose-700 bg-rose-50',
    slate: 'border-t-slate-500 text-slate-700 bg-slate-100',
  }

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-6" aria-label="Summary statistics">
      {cards.map((card) => (
        <article
          className={`group relative overflow-hidden rounded-2xl border border-t-4 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.11)] ${toneClasses[card.tone]?.split(' ')[0]} ${
            activeMetric === card.key ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200'
          }`}
          key={card.key}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50 to-transparent opacity-80" />
          <button className="relative h-full w-full p-3.5 text-left" type="button" onClick={() => onSelectMetric(card.key)}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
              <span className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${toneClasses[card.tone]?.split(' ').slice(1).join(' ')}`}>
                View
              </span>
            </div>
            <p className="mt-4 text-3xl font-extrabold leading-none tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-2 min-h-[30px] text-[10px] leading-4 text-slate-500">{card.note}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${
                card.tone === 'green'
                  ? 'bg-emerald-500'
                  : card.tone === 'rose'
                    ? 'bg-rose-500'
                    : card.tone === 'amber'
                      ? 'bg-amber-500'
                      : card.tone === 'blue'
                        ? 'bg-blue-500'
                        : 'bg-slate-500'
              }`} style={{ width: activeMetric === card.key ? '100%' : '42%' }} />
            </div>
          </button>
        </article>
      ))}
    </section>
  )
}

export default StatCards
