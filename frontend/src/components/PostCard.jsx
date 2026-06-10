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
  }).format(date)
}

function previewText(value, maxLength = 120) {
  if (!value) {
    return 'No caption captured for this post.'
  }

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trim()}...`
}

function PostCard({ post, active, onSelect, onOpen }) {
  const commentCount = post.comments?.length || 0
  const sentimentClass = post.sentiment === 'Positive'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    : post.sentiment === 'Negative'
      ? 'bg-rose-50 text-rose-700 ring-rose-100'
      : 'bg-slate-100 text-slate-600 ring-slate-200'

  return (
    <article
      className={`group grid cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_18px_36px_rgba(15,23,42,0.12)] ${
        active ? 'border-blue-500 ring-4 ring-blue-100' : 'border-slate-200'
      }`}
      onClick={() => {
        onSelect(post.id)
        onOpen(post.id)
      }}
    >
      <div className="relative overflow-hidden bg-slate-100">
        {post.image_url ? (
          <img className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105" src={post.image_url} alt={post.message || 'Facebook post'} />
        ) : (
          <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-slate-100 to-blue-50 text-xs font-semibold text-slate-500">No image</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/45 to-transparent opacity-80" />
        <span className={`absolute left-2.5 top-2.5 inline-flex min-h-[22px] items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold shadow-sm ring-1 ${sentimentClass}`}>
          {post.sentiment || 'Neutral'}
        </span>
      </div>

      <div className="min-w-0 p-3.5">
        <div className="flex flex-col gap-1.5">
          <h3 className="min-h-[42px] text-xs font-extrabold leading-5 text-slate-950">{previewText(post.message, 96)}</h3>

          <p className="text-[11px] font-semibold text-slate-500">{formatDate(post.created_time)}</p>

          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold text-slate-500">
            <span className="rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100"><strong className="block text-xs text-slate-950">{post.likes || 0}</strong>Likes</span>
            <span className="rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100"><strong className="block text-xs text-slate-950">{post.shares || 0}</strong>Shares</span>
            <span className="rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100"><strong className="block text-xs text-slate-950">{commentCount}</strong>Comments</span>
          </div>

          <button
            className="mt-2 rounded-xl bg-gradient-to-r from-slate-950 to-blue-900 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-600"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(post.id)
              onOpen(post.id)
            }}
          >
            Read full post
          </button>
        </div>
      </div>
    </article>
  )
}

export default PostCard
