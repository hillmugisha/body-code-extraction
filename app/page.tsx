'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Job } from '@/lib/supabase'
import JobsTable from '@/components/JobsTable'
import AccuracyCard from '@/components/AccuracyCard'
import UploadDropzone from '@/components/UploadDropzone'
import { useAuth } from '@/context/AuthContext'

const POLL_MS = 5000

export default function DashboardPage() {
  const { userEmail, isLoading: authLoading } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

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

  const totalJobs = jobs.length
  const runningJobs = jobs.filter((j) => j.status === 'running').length
  const totalItems = jobs.reduce((sum, j) => sum + (j.items_extracted ?? 0), 0)

  const scoredJobs = jobs.filter((j) => j.accuracy_score != null)
  const accuracy =
    scoredJobs.length > 0
      ? Math.round(
          (scoredJobs.reduce((sum, j) => sum + (j.accuracy_score ?? 0), 0) / scoredJobs.length) * 100
        ) / 100
      : 0

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ryder - Body Code Extraction</h1>
          <p className="text-xs text-gray-500 mt-0.5">Extract Ford vehicle specs with AI and automatically populate Ryder quote excel file.</p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors text-white shrink-0"
          style={{ backgroundColor: showUpload ? '#193a76' : '#1F4993' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#193a76')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = showUpload ? '#193a76' : '#1F4993')}
        >
          {showUpload ? '✕ Close Upload' : '+ Upload File'}
        </button>
      </div>

      {/* Inline upload panel */}
      {showUpload && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Upload PDF</h2>
          <UploadDropzone />
        </div>
      )}

      {/* KPI cards — single compact row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Requests" value={totalJobs} />
        <StatCard label="Items Extracted" value={totalItems} />
        <AccuracyCard
          label="Overall Accuracy"
          score={accuracy}
          subLabel={`Averaged across ${scoredJobs.length} scored request${scoredJobs.length !== 1 ? 's' : ''}`}
          total={totalItems}
          corrected={0}
        />
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-gray-800">
            Recent Requests
            {runningJobs > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                {runningJobs} running
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={loadJobs}
              className="flex items-center gap-1.5 text-sm border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <a href="/jobs" className="text-sm hover:underline" style={{ color: '#1F4993' }}>
              View all
            </a>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Loading requests...</p>
        ) : (
          <JobsTable jobs={jobs} limit={10} />
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3 transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-md hover:border-gray-200 cursor-default">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold leading-tight text-gray-900">{value.toLocaleString()}</p>
    </div>
  )
}
