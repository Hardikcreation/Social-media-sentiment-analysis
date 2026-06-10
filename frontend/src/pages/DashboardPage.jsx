import { useEffect, useState, useTransition } from 'react'
import PageSelector from '../components/PageSelector'
import StatCards from '../components/StatCards'
import ChartPanels from '../components/ChartPanels'
import PostCard from '../components/PostCard'
import Footer from '../components/Footer'
import MetricDrilldown from '../components/MetricDrilldown'
import { useDashboardData } from '../hooks/useDashboardData'

const DEFAULT_PAGE_ID = '1052601808104708'
const METRIC_DETAILS = {
  total_posts: {
    label: 'Posts tracked',
    helper: 'Facebook posts available in the current page feed.',
  },
  total_comments: {
    label: 'Comments classified',
    helper: 'Audience comments that were captured and scored for sentiment.',
  },
  total_likes: {
    label: 'Likes',
    helper: 'Reactions recorded on the page feed items.',
  },
  total_shares: {
    label: 'Shares',
    helper: 'Post re-share activity across the selected page.',
  },
  positive_pct: {
    label: 'Positive sentiment',
    helper: 'Share of comments classified as positive.',
  },
  negative_pct: {
    label: 'Negative sentiment',
    helper: 'Share of comments classified as negative.',
  },
}
const DRILLDOWN_CONFIG = {
  total_posts: {
    metricKey: 'total_posts',
    title: 'Posts tracked',
    description: 'Full post inventory for the selected Facebook page.',
    listTitle: 'Post list',
    listDescription: 'Every fetched post, with image, timestamp, and engagement context.',
    type: 'posts',
  },
  total_comments: {
    metricKey: 'total_comments',
    title: 'Comments classified',
    description: 'Audience comments that were captured and scored for sentiment.',
    listTitle: 'Comment list',
    listDescription: 'Flattened comment inventory for the selected page.',
    type: 'comments',
  },
  total_likes: {
    metricKey: 'total_likes',
    title: 'Engagement likes',
    description: 'Posts ranked by like volume.',
    listTitle: 'Top liked posts',
    listDescription: 'Posts ordered by reaction count.',
    type: 'posts',
  },
  total_shares: {
    metricKey: 'total_shares',
    title: 'Share actions',
    description: 'Posts ranked by share activity.',
    listTitle: 'Top shared posts',
    listDescription: 'Posts ordered by share count.',
    type: 'posts',
  },
  positive_pct: {
    metricKey: 'positive_pct',
    title: 'Positive sentiment',
    description: 'Comments classified as positive.',
    listTitle: 'Positive comment list',
    listDescription: 'Only comments with a positive sentiment label.',
    type: 'comments',
  },
  negative_pct: {
    metricKey: 'negative_pct',
    title: 'Negative sentiment',
    description: 'Comments classified as negative.',
    listTitle: 'Negative comment list',
    listDescription: 'Only comments with a negative sentiment label.',
    type: 'comments',
  },
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search)

  return {
    pageId: params.get('page') || DEFAULT_PAGE_ID,
    metric: params.get('metric') || 'total_comments',
    postId: params.get('post') || null,
    drilldown: params.get('drilldown') || null,
  }
}

function writeUrlState({ pageId, metric, postId, drilldown }, mode = 'push') {
  const params = new URLSearchParams()

  if (pageId) {
    params.set('page', pageId)
  }
  if (metric) {
    params.set('metric', metric)
  }
  if (postId) {
    params.set('post', postId)
  }
  if (drilldown) {
    params.set('drilldown', drilldown)
  }

  const nextUrl = `${window.location.pathname}?${params.toString()}`
  const historyMethod = mode === 'replace' ? 'replaceState' : 'pushState'
  window.history[historyMethod]({ pageId, metric, postId, drilldown }, '', nextUrl)
}

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

function trimText(value, maxLength = 220) {
  if (!value) {
    return 'No caption was captured for this post.'
  }

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength).trim()}...`
}

function getPostSourceUrl(post) {
  if (!post) {
    return null
  }

  return post.permalink_url || post.post_url || post.url || post.link || `https://www.facebook.com/${post.id}`
}

function DashboardPage() {
  const initialUrlState = typeof window !== 'undefined'
    ? readUrlState()
    : { pageId: DEFAULT_PAGE_ID, metric: 'total_comments', postId: null, drilldown: null }
  const initialTheme = typeof window !== 'undefined'
    ? window.localStorage.getItem('dashboard-theme') || 'light'
    : 'light'

  const [selectedPageId, setSelectedPageId] = useState(initialUrlState.pageId)
  const [requestedPostId, setRequestedPostId] = useState(initialUrlState.postId)
  const [selectedMetric, setSelectedMetric] = useState(initialUrlState.metric)
  const [drilldownKey, setDrilldownKey] = useState(initialUrlState.drilldown)
  const [fullPostId, setFullPostId] = useState(null)
  const [theme, setTheme] = useState(initialTheme)
  const [isPending, startTransition] = useTransition()
  const { data, loading, error, reload } = useDashboardData(selectedPageId)
  const isDarkTheme = theme === 'dark'

  const posts = data?.posts || []
  const requestedPostExists = posts.some((post) => post.id === requestedPostId)
  const activePostId = requestedPostExists ? requestedPostId : data?.active_post_id || posts[0]?.id || null
  const activePost = data?.posts?.find((post) => post.id === activePostId) || data?.active_post || data?.posts?.[0] || null
  const fullPost = posts.find((post) => post.id === fullPostId) || null
  const fullPostUrl = getPostSourceUrl(fullPost)
  const selectedPage = data?.selected_page
  const activePostComments = activePost?.comments || []
  const activeMetric = METRIC_DETAILS[selectedMetric] || METRIC_DETAILS.total_comments
  const allComments = posts.flatMap((post) =>
    (post.comments || []).map((comment) => ({
      ...comment,
      postMessage: post.message,
      post_id: comment.post_id || post.id,
    })),
  )

  const drilldownItems = (() => {
    switch (drilldownKey) {
      case 'total_posts':
        return posts
      case 'total_comments':
        return allComments
      case 'total_likes':
        return [...posts].sort((left, right) => (right.likes || 0) - (left.likes || 0))
      case 'total_shares':
        return [...posts].sort((left, right) => (right.shares || 0) - (left.shares || 0))
      case 'positive_pct':
        return allComments.filter((comment) => comment.sentiment === 'Positive')
      case 'negative_pct':
        return allComments.filter((comment) => comment.sentiment === 'Negative')
      default:
        return []
    }
  })()

  const handleOpenMetric = (metricKey) => {
    setSelectedMetric(metricKey)
    setDrilldownKey(metricKey)
    writeUrlState({
      pageId: selectedPageId,
      metric: metricKey,
      postId: requestedPostId,
      drilldown: metricKey,
    })
  }

  const handleOpenPostFromDrilldown = (postId) => {
    setRequestedPostId(postId)
    setDrilldownKey(null)
    writeUrlState({
      pageId: selectedPageId,
      metric: selectedMetric,
      postId,
      drilldown: null,
    })
  }

  const handleSelectPost = (postId) => {
    setRequestedPostId(postId)
    writeUrlState({
      pageId: selectedPageId,
      metric: selectedMetric,
      postId,
      drilldown: null,
    })
  }

  const handleOpenFullPost = (postId) => {
    setRequestedPostId(postId)
    setFullPostId(postId)
    writeUrlState({
      pageId: selectedPageId,
      metric: selectedMetric,
      postId,
      drilldown: null,
    })
  }

  const handleBackToDashboard = () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    setDrilldownKey(null)
    writeUrlState({
      pageId: selectedPageId,
      metric: selectedMetric,
      postId: requestedPostId,
      drilldown: null,
    }, 'replace')
  }

  useEffect(() => {
    const handlePopState = () => {
      const nextState = readUrlState()
      setSelectedPageId(nextState.pageId)
      setSelectedMetric(nextState.metric)
      setRequestedPostId(nextState.postId)
      setDrilldownKey(nextState.drilldown)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    writeUrlState({
      pageId: selectedPageId,
      metric: selectedMetric,
      postId: requestedPostId,
      drilldown: drilldownKey,
    }, 'replace')
  }, [drilldownKey, requestedPostId, selectedMetric, selectedPageId])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setFullPostId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', isDarkTheme)
    window.localStorage.setItem('dashboard-theme', theme)
  }, [isDarkTheme, theme])

  return (
    <div className="min-h-screen bg-transparent px-2.5 py-3 md:px-4">
      <div className="dashboard-shell mx-auto flex w-full max-w-[1440px] flex-col gap-4 rounded-[24px] p-2 md:p-3">
      {drilldownKey && data ? (
        <>
          <MetricDrilldown
            config={DRILLDOWN_CONFIG[drilldownKey]}
            items={drilldownItems}
            onBack={handleBackToDashboard}
            onOpenPost={handleOpenPostFromDrilldown}
          />
          <Footer />
        </>
      ) : (
        <>
      <header className="motion-enter glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-slate-100 bg-slate-950 px-4 py-3 text-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white/12 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white">Social analytics</span>
              <span className="rounded-md bg-emerald-400/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-200">Live report</span>
              <span className="rounded-md bg-blue-400/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-200">Facebook</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
              <span>Overview</span>
              <span>Sentiment</span>
              <span>Posts</span>
              <span>Evidence</span>
              <button
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
                type="button"
                onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
                aria-label={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
              >
                {isDarkTheme ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
              Facebook sentiment dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Track page health, engagement momentum, and audience response quality in a polished reporting workspace.
            </p>

            <div className="mt-4 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Focus</span>
                <strong className="mt-1 block truncate text-sm text-slate-950">{selectedPage?.label || 'Loading page'}</strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Posts</span>
                <strong className="mt-1 block text-sm text-slate-950">{posts.length}</strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Comments</span>
                <strong className="mt-1 block text-sm text-slate-950">{allComments.length}</strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-500">Lens</span>
                <strong className="mt-1 block truncate text-sm text-slate-950">{activeMetric.label}</strong>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Report health</span>
              <div className="mt-2 flex items-end justify-between gap-6">
                <strong className="text-3xl font-extrabold text-slate-950">{Math.round(data?.sentiment_summary?.positive_pct || 0)}%</strong>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">Positive</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(Math.max(data?.sentiment_summary?.positive_pct || 0, 0), 100)}%` }}
                />
              </div>
            </div>
            <PageSelector
              pages={data?.pages || []}
              selectedPageId={selectedPageId}
              onChange={(value) => {
                startTransition(() => {
                  setDrilldownKey(null)
                  setRequestedPostId(null)
                  setSelectedPageId(value)
                  writeUrlState({
                    pageId: value,
                    metric: selectedMetric,
                    postId: null,
                    drilldown: null,
                  })
                })
              }}
              onRefresh={reload}
              loading={loading || isPending}
            />
          </div>
        </div>
      </header>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700" type="button" onClick={reload}>
            Try again
          </button>
        </section>
      ) : null}

      {loading && !data ? (
        <section className="soft-panel rounded-2xl p-4">
          <h2 className="text-lg font-bold text-slate-950">Loading dashboard</h2>
          <p className="mt-2 text-sm text-slate-500">Fetching the latest page metrics, post imagery, and comment sentiment from Flask.</p>
        </section>
      ) : null}

      {data ? (
        <>
       
          <StatCards
            stats={data.stats}
            sentimentSummary={data.sentiment_summary}
            activeMetric={selectedMetric}
            onSelectMetric={handleOpenMetric}
          />

          <main className="grid items-start gap-3 xl:grid-cols-12">
            <section className="space-y-3 xl:col-span-8">
              <ChartPanels
                totalSentimentChart={data.total_sentiment_chart}
                sentimentSummary={data.sentiment_summary}
              />
            </section>

            <aside className="space-y-3 xl:col-span-4">
              <section className="premium-card flex h-[320px] flex-col overflow-hidden rounded-2xl p-4">
                <div className="mb-3 flex flex-none flex-col gap-2 border-b border-slate-100 pb-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight text-slate-950">Post spotlight</h2>
                    <p className="mt-1 text-xs text-slate-500">Current post and response quality.</p>
                  </div>
                  <span className={`inline-flex min-h-[20px] items-center rounded-md px-2.5 py-1 text-[10px] font-extrabold ${
                    activePost?.sentiment === 'Positive'
                      ? 'bg-emerald-50 text-emerald-700'
                      : activePost?.sentiment === 'Negative'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {activePost?.sentiment || 'Neutral'}
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-auto pr-1">
                {activePost ? (
                  <div>
                    <div>
                      {activePost.image_url ? (
                        <a href={activePost.image_url} target="_blank" rel="noreferrer">
                          <img
                            className="aspect-[16/7] w-full rounded-lg border border-slate-200 object-cover shadow-sm"
                            src={activePost.image_url}
                            alt={activePost.message || 'Selected Facebook post'}
                          />
                        </a>
                      ) : (
                        <div className="grid aspect-[16/7] place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">No image available</div>
                      )}
                    </div>

                    <div className="mt-3 space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <h3 className="text-xs font-extrabold leading-5 text-slate-950">{trimText(activePost.message, 120)}</h3>
                        <p className="mt-1 text-[11px] text-slate-500">{formatDate(activePost.created_time)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-blue-700" type="button" onClick={() => handleOpenFullPost(activePost.id)}>
                            Read full post
                          </button>
                          <a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:border-blue-400 hover:text-blue-700" href={getPostSourceUrl(activePost)} target="_blank" rel="noreferrer">
                            Open source
                          </a>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Likes</span>
                          <strong className="mt-0.5 block text-sm font-extrabold text-slate-950">{activePost.likes || 0}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Shares</span>
                          <strong className="mt-0.5 block text-sm font-extrabold text-slate-950">{activePost.shares || 0}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Comments</span>
                          <strong className="mt-0.5 block text-sm font-extrabold text-slate-950">{activePostComments.length}</strong>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          <span>Recent audience responses</span>
                          <span>{activePostComments.length} rows</span>
                        </div>

                        {activePostComments.length ? (
                          <div className="max-h-[190px] space-y-2 overflow-auto pr-1">
                            {activePostComments.slice(0, 6).map((comment) => (
                              <div className="rounded-lg border border-slate-200 bg-white p-2.5" key={comment.id}>
                                <div className="text-xs leading-5 text-slate-900">{comment.message}</div>
                                <div className="mt-2 flex flex-col gap-2 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                                  <span className={`inline-flex min-h-[26px] items-center rounded-full px-3 py-1 text-[11px] font-bold ${
                                    comment.sentiment === 'Positive'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : comment.sentiment === 'Negative'
                                        ? 'bg-rose-50 text-rose-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {comment.sentiment || 'Neutral'}
                                  </span>
                                  <span>{formatDate(comment.created_time)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No comments were captured for the selected post.</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          <span>All page posts</span>
                          <span>{posts.length} posts</span>
                        </div>

                        <div className="max-h-[200px] space-y-2 overflow-auto pr-1">
                          {posts.map((post) => (
                            <button
                              className={`flex w-full items-start gap-2 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 ${
                                post.id === activePostId
                                  ? 'border-blue-500 bg-white ring-2 ring-blue-100'
                                  : 'border-slate-200 bg-white hover:border-blue-400'
                              }`}
                              key={post.id}
                              type="button"
                              onClick={() => handleOpenFullPost(post.id)}
                            >
                              <div className="h-12 w-16 flex-none overflow-hidden rounded-lg border border-slate-200 bg-white">
                                {post.image_url ? (
                                  <img className="h-full w-full object-cover" src={post.image_url} alt={post.message || 'Facebook post'} />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-[11px] font-semibold text-slate-500">No image</div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-xs font-bold leading-4 text-slate-950">
                                    {trimText(post.message, 58)}
                                  </p>
                                  <span className={`inline-flex min-h-[22px] items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    post.sentiment === 'Positive'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : post.sentiment === 'Negative'
                                        ? 'bg-rose-50 text-rose-700'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {post.sentiment || 'Neutral'}
                                  </span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-500">
                                  <span>{formatDate(post.created_time)}</span>
                                  <span>{post.comments?.length || 0} comments</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">Select a post to inspect its image, engagement, and comments.</div>
                )}
                </div>
              </section>
            </aside>
          </main>

          <section className="premium-card -mt-1 rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold tracking-tight text-slate-950">Post explorer</h2>
                <p className="mt-1 text-xs text-slate-500">Browse the fetched page feed.</p>
              </div>
              <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{data.posts?.length || 0} posts</span>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {data.posts?.length ? (
                data.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    active={post.id === activePostId}
                    onSelect={handleSelectPost}
                    onOpen={handleOpenFullPost}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No posts were returned for this page.</div>
              )}
            </div>
          </section>

          {fullPost ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-3 py-6 backdrop-blur-md" role="dialog" aria-modal="true">
              <section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.45)]">
                <div className="flex flex-col gap-3 border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-200">Full post view</p>
                    <h2 className="mt-1 text-xl font-extrabold">Post details and audience response</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {fullPostUrl ? (
                      <a className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:bg-blue-500" href={fullPostUrl} target="_blank" rel="noreferrer">
                        Open source post
                      </a>
                    ) : null}
                    <button className="inline-flex min-h-10 items-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/20" type="button" onClick={() => setFullPostId(null)}>
                      Close
                    </button>
                  </div>
                </div>

                <div className="grid max-h-[calc(92vh-80px)] overflow-auto bg-slate-50 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
                  <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                    {fullPost.image_url ? (
                      <a href={fullPost.image_url} target="_blank" rel="noreferrer">
                        <img className="max-h-[560px] w-full rounded-2xl border border-slate-200 bg-white object-contain shadow-[0_18px_40px_rgba(15,23,42,0.12)]" src={fullPost.image_url} alt={fullPost.message || 'Full post'} />
                      </a>
                    ) : (
                      <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">No image available</div>
                    )}
                  </div>

                  <div className="space-y-4 bg-white p-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                          fullPost.sentiment === 'Positive'
                            ? 'bg-emerald-50 text-emerald-700'
                            : fullPost.sentiment === 'Negative'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {fullPost.sentiment || 'Neutral'}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{formatDate(fullPost.created_time)}</span>
                      </div>
                      <h3 className="text-base font-extrabold leading-7 text-slate-950">{fullPost.message || 'No caption was captured for this post.'}</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Likes</span>
                        <strong className="mt-1 block text-lg font-extrabold text-slate-950">{fullPost.likes || 0}</strong>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Shares</span>
                        <strong className="mt-1 block text-lg font-extrabold text-slate-950">{fullPost.shares || 0}</strong>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Comments</span>
                        <strong className="mt-1 block text-lg font-extrabold text-slate-950">{fullPost.comments?.length || 0}</strong>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-sm font-extrabold text-slate-950">Comments</h4>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{fullPost.comments?.length || 0} rows</span>
                      </div>
                      {fullPost.comments?.length ? (
                        <div className="space-y-2">
                          {fullPost.comments.map((comment) => (
                            <article className="rounded-xl border border-slate-200 bg-white p-3" key={comment.id}>
                              <p className="text-sm leading-6 text-slate-900">{comment.message}</p>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                <span className={`rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
                                  comment.sentiment === 'Positive'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : comment.sentiment === 'Negative'
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {comment.sentiment || 'Neutral'}
                                </span>
                                <span>{formatDate(comment.created_time)}</span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No comments were captured for this post.</div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          <section className="premium-card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-extrabold tracking-tight text-slate-950">Report context</h2>
                  <p className="mt-1 text-xs text-slate-500">Current selection metadata.</p>
                </div>
              </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Selected lens</span>
                <strong className="mt-1 block text-xs font-bold text-slate-950">{activeMetric.label}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Metric note</span>
                <strong className="mt-1 block text-xs font-bold text-slate-950">{activeMetric.helper}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Selected post</span>
                <strong className="mt-1 block text-xs font-bold text-slate-950">{activePost ? formatDate(activePost.created_time) : 'No post selected'}</strong>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Current focus</span>
                <strong className="mt-1 block text-xs font-bold text-slate-950">{selectedPage?.label || 'Page not selected'}</strong>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <Footer />
        </>
      )}
      </div>
    </div>
  )
}

export default DashboardPage
