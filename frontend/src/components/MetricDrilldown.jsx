function formatDate(value) {
  if (!value) {
    return 'No timestamp'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function trimText(value, maxLength = 170) {
  if (!value) {
    return 'No text captured.'
  }

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trim()}...`
}

function PostRow({ item, metricKey, onOpenPost }) {
  const metricValue = metricKey === 'total_shares' ? item.shares || 0 : item.likes || 0
  const metricLabel = metricKey === 'total_shares' ? 'Shares' : metricKey === 'total_likes' ? 'Likes' : 'Comments'
  const sentimentClass = item.sentiment === 'Positive'
    ? 'bg-emerald-50 text-emerald-700'
    : item.sentiment === 'Negative'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-slate-100 text-slate-600'

  return (
    <article className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_18px_36px_rgba(15,23,42,0.1)] md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {item.image_url ? (
          <img className="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-105 md:h-full" src={item.image_url} alt={item.message || 'Facebook post'} />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-xs font-semibold text-slate-500">No image</div>
        )}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold leading-7 text-slate-950">{trimText(item.message, 150)}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">{formatDate(item.created_time)}</p>
          </div>
          <span className={`inline-flex min-h-[26px] items-center rounded-md px-3 py-1 text-[11px] font-extrabold ${sentimentClass}`}>
            {item.sentiment || 'Neutral'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500 sm:grid-cols-4">
          <span className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">{metricLabel}: <strong className="text-slate-950">{metricKey === 'total_posts' ? item.comments?.length || 0 : metricValue}</strong></span>
          <span className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">Likes: <strong className="text-slate-950">{item.likes || 0}</strong></span>
          <span className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">Shares: <strong className="text-slate-950">{item.shares || 0}</strong></span>
          <span className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">Comments: <strong className="text-slate-950">{item.comments?.length || 0}</strong></span>
        </div>

        <button className="w-fit rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700" type="button" onClick={() => onOpenPost(item.id)}>
          Open in dashboard
        </button>
      </div>
    </article>
  )
}

function CommentRow({ item, onOpenPost }) {
  const sentimentClass = item.sentiment === 'Positive'
    ? 'bg-emerald-50 text-emerald-700'
    : item.sentiment === 'Negative'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-slate-100 text-slate-600'

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_18px_36px_rgba(15,23,42,0.1)]">
      <div className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold leading-7 text-slate-950">{trimText(item.message, 220)}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">{formatDate(item.created_time)}</p>
          </div>
          <span className={`inline-flex min-h-[26px] items-center rounded-md px-3 py-1 text-[11px] font-extrabold ${sentimentClass}`}>
            {item.sentiment || 'Neutral'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">Post ID: <strong className="text-slate-950">{item.post_id}</strong></span>
          <span className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">Post snippet: <strong className="text-slate-950">{trimText(item.postMessage, 90)}</strong></span>
        </div>

        <button className="w-fit rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700" type="button" onClick={() => onOpenPost(item.post_id)}>
          Open parent post
        </button>
      </div>
    </article>
  )
}

function MetricDrilldown({ config, items, onBack, onOpenPost }) {
  return (
    <section className="space-y-4">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.1)]">
        <div className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-4 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-200">Drilldown workspace</p>
          <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{config.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">{config.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-xl bg-white/10 px-3 py-2 text-xs font-extrabold text-white">{items.length} rows</span>
              <button className="rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-slate-950 shadow-sm transition hover:bg-blue-50" type="button" onClick={onBack}>
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="premium-card rounded-3xl p-4">
        <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-950">{config.listTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{config.listDescription}</p>
          </div>
          <span className="w-fit rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-600">{items.length} records</span>
        </div>

        {items.length ? (
          <div className="grid gap-3">
            {items.map((item) =>
              config.type === 'comments' ? (
                <CommentRow item={item} key={item.id} onOpenPost={onOpenPost} />
              ) : (
                <PostRow item={item} key={item.id} metricKey={config.metricKey} onOpenPost={onOpenPost} />
              ),
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">No records are available for this drilldown.</div>
        )}
      </section>
    </section>
  )
}

export default MetricDrilldown
