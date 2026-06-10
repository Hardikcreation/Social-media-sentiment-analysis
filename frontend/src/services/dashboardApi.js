export async function fetchDashboard(pageId, signal) {
  const params = new URLSearchParams()

  if (pageId) {
    params.set('page_id', pageId)
  }

  const response = await fetch(`/api/facebook-dashboard?${params.toString()}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Dashboard request failed with status ${response.status}`)
  }

  const payload = await response.json()

  if (!payload.success) {
    throw new Error(payload.error || 'Failed to load dashboard data')
  }

  return payload.data
}
