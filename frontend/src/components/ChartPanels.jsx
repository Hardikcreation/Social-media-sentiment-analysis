import { useState } from 'react'

const SENTIMENT_META = {
  Positive: {
    color: '#10b981',
    fill: 'rgba(16, 185, 129, 0.16)',
    soft: '#edf8f1',
    label: 'Positive',
  },
  Negative: {
    color: '#f43f5e',
    fill: 'rgba(244, 63, 94, 0.14)',
    soft: '#fdf0ee',
    label: 'Negative',
  },
  Neutral: {
    color: '#64748b',
    fill: 'rgba(100, 116, 139, 0.16)',
    soft: '#eff2f6',
    label: 'Neutral',
  },
}

function formatPercent(value) {
  return `${Math.round(value || 0)}%`
}

function buildDonutGradient(summary) {
  const total = summary?.total || 0

  if (!total) {
    return 'conic-gradient(#cfd8e3 0deg 360deg)'
  }

  const positive = summary.positive_pct || 0
  const negative = summary.negative_pct || 0
  const neutral = summary.neutral_pct || 0
  const positiveStop = positive * 3.6
  const negativeStop = positiveStop + negative * 3.6
  const neutralStop = negativeStop + neutral * 3.6

  return `conic-gradient(#10b981 0deg ${positiveStop}deg, #f43f5e ${positiveStop}deg ${negativeStop}deg, #64748b ${negativeStop}deg ${neutralStop}deg)`
}

function buildChartGeometry(values, width, height, padding) {
  const safeValues = values.length ? values : [0]
  const maxValue = Math.max(...safeValues, 1)
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? width / 2 : padding + (usableWidth * index) / (safeValues.length - 1)
    const y = height - padding - (value / maxValue) * usableHeight
    return [x, y]
  })

  const linePath = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${height - padding} L ${points[0][0]} ${height - padding} Z`

  return { points, linePath, areaPath }
}

function MiniAreaChart({ values, color, fill, activeIndex = null }) {
  const width = 320
  const height = 110
  const padding = 12
  const { points, linePath, areaPath } = buildChartGeometry(values, width, height, padding)

  return (
    <svg className="h-[66px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      {points.map(([x, y], index) => (
        <circle
          cx={x}
          cy={y}
          key={`${x}-${y}`}
          r={activeIndex === index ? '5.5' : '4'}
          fill="#ffffff"
          stroke={color}
          strokeWidth="2.5"
        />
      ))}
    </svg>
  )
}

function SentimentMetricCards({ chart, selectedSentiment, onSelectSentiment }) {
  const labels = chart?.labels || []
  const values = chart?.values || []
  const total = values.reduce((sum, value) => sum + value, 0)

  return (
    <div className="grid w-full gap-2 md:grid-cols-3">
      {labels.map((label, index) => {
        const value = values[index] || 0
        const meta = SENTIMENT_META[label]
        const share = total ? (value / total) * 100 : 0
        const miniValues = [
          Math.max(0, Math.round(value * 0.36)),
          Math.max(0, Math.round(value * 0.68)),
          Math.max(0, Math.round(value * 0.82)),
          Math.max(0, Math.round(value * 0.73)),
          value,
        ]

        return (
          <button
            className={`rounded-xl border p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-white hover:shadow-md ${
              selectedSentiment === label
                ? 'border-blue-500 bg-white ring-4 ring-blue-100'
                : 'border-slate-200 bg-white'
            }`}
            key={label}
            type="button"
            onClick={() => onSelectSentiment(label)}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{meta.label}</span>
                <strong className="mt-1 block text-2xl font-extrabold text-slate-950">{value}</strong>
              </div>
              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{formatPercent(share)}</span>
            </div>
            <MiniAreaChart values={miniValues} color={meta.color} fill={meta.fill} />
          </button>
        )
      })}
    </div>
  )
}

function SentimentDonut({ summary, selectedSentiment, onSelectSentiment }) {
  return (
    <div className="grid w-full gap-4 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-center">
      <div
        className="relative mx-auto aspect-square w-full max-w-[190px] rounded-full shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
        style={{ background: buildDonutGradient(summary) }}
      >
        <div className="absolute inset-[16px] grid place-items-center rounded-full border border-slate-200 bg-white text-center shadow-inner">
          <div>
            <strong className="block text-3xl font-extrabold text-slate-950">{summary?.total ?? 0}</strong>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">comments</span>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        {['Positive', 'Negative', 'Neutral'].map((label) => (
          <button
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 ${
              selectedSentiment === label
                ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                : 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm'
            }`}
            key={label}
            type="button"
            onClick={() => onSelectSentiment(label)}
          >
            <span className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${
                label === 'Positive' ? 'bg-emerald-500' : label === 'Negative' ? 'bg-rose-500' : 'bg-slate-400'
              }`} />
              <span className="text-xs font-bold text-slate-900">{label}</span>
            </span>
            <strong className="text-xs font-extrabold text-slate-950">{formatPercent(summary?.[`${label.toLowerCase()}_pct`])}</strong>
          </button>
        ))}
      </div>
    </div>
  )
}

function ChartPanels({ totalSentimentChart, sentimentSummary }) {
  const defaultSentiment = (() => {
    const entries = [
      ['Positive', sentimentSummary?.positive || 0],
      ['Negative', sentimentSummary?.negative || 0],
      ['Neutral', sentimentSummary?.neutral || 0],
    ]
    return entries.sort((left, right) => right[1] - left[1])[0]?.[0] || 'Positive'
  })()

  const [requestedSentiment, setRequestedSentiment] = useState(null)

  const selectedSentiment = requestedSentiment && SENTIMENT_META[requestedSentiment]
    ? requestedSentiment
    : defaultSentiment

  const handleSentimentChange = (sentiment) => {
    setRequestedSentiment(sentiment)
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="premium-card flex h-[320px] flex-col rounded-2xl p-4">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-950">Comment sentiment</h2>
            <p className="mt-1 text-xs text-slate-500">Positive, negative, and neutral response volume.</p>
          </div>
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-blue-700">Trend</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center">
          <SentimentMetricCards
            chart={totalSentimentChart}
            selectedSentiment={selectedSentiment}
            onSelectSentiment={handleSentimentChange}
          />
        </div>
      </section>

      <section className="premium-card flex h-[320px] flex-col rounded-2xl p-4">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-950">Sentiment mix</h2>
            <p className="mt-1 text-xs text-slate-500">Overall balance of audience response.</p>
          </div>
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">Total</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center">
          <SentimentDonut
            summary={sentimentSummary}
            selectedSentiment={selectedSentiment}
            onSelectSentiment={handleSentimentChange}
          />
        </div>
      </section>

    </div>
  )
}

export default ChartPanels
