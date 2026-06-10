function PageSelector({ pages, selectedPageId, onChange, onRefresh, loading }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:w-auto sm:flex-row sm:items-end">
      <label className="grid gap-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Active page</span>
        <select
          className="min-h-11 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:min-w-[280px]"
          value={selectedPageId}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Select Facebook page"
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.label}
            </option>
          ))}
        </select>
      </label>

      <button
        className="min-h-11 rounded-xl bg-gradient-to-r from-slate-950 to-blue-900 px-4 text-xs font-extrabold text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-600 disabled:cursor-wait disabled:translate-y-0 disabled:opacity-70"
        type="button"
        onClick={onRefresh}
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  )
}

export default PageSelector
