'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Job, ExtractionItem } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import AccuracyCard from '@/components/AccuracyCard'
import ItemsTable from '@/components/ItemsTable'

interface AccuracyStats {
  total_items: number
  corrected_items: number
  accuracy_score: number
  pre_score: number
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [items, setItems] = useState<ExtractionItem[]>([])
  const [accuracy, setAccuracy] = useState<AccuracyStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/jobs/${id}`).then((r) => r.json()),
      fetch(`/api/accuracy?job_id=${id}`).then((r) => r.json()),
    ])
      .then(([jobData, accData]) => {
        setJob(jobData.job ?? null)
        setItems(jobData.items ?? [])
        setAccuracy(accData)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [id])

  if (loading) {
    return <p className="text-sm text-gray-400 py-10 text-center">Loading job...</p>
  }

  if (!job) {
    return <p className="text-sm text-red-500 py-10 text-center">Job not found.</p>
  }

  const canDownload = job.status === 'completed' || job.status === 'completed_with_warnings'

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-gray-900 truncate max-w-2xl">
              {job.vehicle_title || job.pdf_filename}
            </h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-gray-500 font-mono">{job.pdf_filename}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Job ID: {job.job_id} · {new Date(job.created_at).toLocaleString()}
          </p>
          {job.error_message && (
            <p className="text-sm text-red-600 mt-1">Error: {job.error_message}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={loadData}
            className="text-sm border border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg"
          >
            Refresh
          </button>
          {canDownload && (
            <a
              href={`/api/jobs/${job.job_id}/download`}
              className="text-sm bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Download Excel
            </a>
          )}
        </div>
      </div>

      {/* Accuracy */}
      {accuracy && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AccuracyCard
            label="Accuracy Score"
            score={accuracy.accuracy_score}
            subLabel="Pre-score"
            subScore={accuracy.pre_score}
            total={accuracy.total_items}
            corrected={accuracy.corrected_items}
          />
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Items Extracted</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{accuracy.total_items}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Corrections Made</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{accuracy.corrected_items}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Pages Scanned</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {job.page_range_start !== null && job.page_range_end !== null
                ? job.page_range_end - job.page_range_start + 1
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Items table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Extracted Items ({items.length})
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Click <strong>Correct</strong> on any row to log a manual correction. Corrected rows are
          highlighted and tracked in the accuracy score.
        </p>
        <ItemsTable items={items} jobId={job.job_id} onCorrectionSaved={loadData} />
      </div>
    </div>
  )
}
