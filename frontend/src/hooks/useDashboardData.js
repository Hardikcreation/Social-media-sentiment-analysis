import { useEffect, useState } from 'react'
import { fetchDashboard } from '../services/dashboardApi'

export function useDashboardData(pageId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!pageId) {
      return undefined
    }

    const controller = new AbortController()
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError(null)

      try {
        const payload = await fetchDashboard(pageId, controller.signal)

        if (active) {
          setData(payload)
        }
      } catch (requestError) {
        if (requestError.name === 'AbortError') {
          return
        }

        if (active) {
          setError(requestError.message || 'Unable to load dashboard data')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      active = false
      controller.abort()
    }
  }, [pageId, refreshTick])

  return {
    data,
    loading,
    error,
    reload: () => setRefreshTick((value) => value + 1),
  }
}
