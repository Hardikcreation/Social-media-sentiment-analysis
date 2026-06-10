function Footer() {
  return (
    <footer className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="text-xs font-semibold text-slate-500">
          Copyright {new Date().getFullYear()} Social Sentiment Report. All rights reserved.
        </p>
        <span className="mx-auto w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-600 sm:mx-0">
          Analytics workspace
        </span>
      </div>
    </footer>
  )
}

export default Footer
