'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Job } from '@/lib/supabase'
import JobsTable from '@/components/JobsTable'
import { useAuth } from '@/context/AuthContext'

type Filter = 'all' | Job['status']

const POLL_MS = 5000

const filters: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Warnings', value: 'completed_with_warnings' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
]

export default function JobsPage() {
  const { userEmail, isLoading: authLoading } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  const loadJobs = useCallback(async () => {
    if (authLoading || !userEmail) return
    try {
      const res = await fetch(`/api/jobs?t=${Date.now()}&email=${encodeURIComponent(userEmail)}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setJobs(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [userEmail, authLoading])

  useEffect(() => {
    loadJobs()
    const timer = setInterval(loadJobs, POLL_MS)
    return () => clearInterval(timer)
  }, [loadJobs])

  const displayed = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
        <p className="text-sm text-gray-500 mt-1">All PDF extraction requests</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-400'
            }`}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                {jobs.filter((j) => j.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Loading requests...</p>
      ) : (
        <JobsTable jobs={displayed} />
      )}
    </div>
  )
}
