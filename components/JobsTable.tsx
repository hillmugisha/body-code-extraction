'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Job } from '@/lib/supabase'
import StatusBadge from './StatusBadge'

const PAGE_SIZE = 10

interface JobsTableProps {
  jobs: Job[]
  limit?: number  // if set: show that many rows, no pagination (used on dashboard)
}

export default function JobsTable({ jobs, limit }: JobsTableProps) {
  const [page, setPage] = useState(1)

  // Dashboard mode: slice and show without pagination
  if (limit !== undefined) {
    const displayed = jobs.slice(0, limit)
    if (displayed.length === 0) return <EmptyState />
    return <Table rows={displayed} />
  }

  // Full paginated mode
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const displayed = jobs.slice(start, start + PAGE_SIZE)

  if (jobs.length === 0) return <EmptyState />

  return (
    <div className="space-y-3">
      <Table rows={displayed} />
      <Pagination
        page={safePage}
        totalPages={totalPages}
        total={jobs.length}
        start={start}
        end={Math.min(start + PAGE_SIZE, jobs.length)}
        onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
      />
    </div>
  )
}

function EmptyState() {
  return (
    <p className="text-sm text-gray-500 py-6 text-center">
      No requests found. Use the <strong>Upload File</strong> button above to get started.
    </p>
  )
}

function Table({ rows }: { rows: Job[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">PDF Filename</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Base Vehicle</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Vehicle Title</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Items</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Accuracy</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Uploaded By</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((job) => (
            <tr key={job.job_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs max-w-xs truncate" title={job.pdf_filename}>
                <Link href={`/jobs/${job.job_id}`} className="text-brand-600 hover:underline">
                  {job.pdf_filename}
                </Link>
              </td>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">
                {job.base_vehicle ?? '—'}
              </td>
              <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={job.vehicle_title ?? ''}>
                {job.vehicle_title ?? '—'}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={job.status} />
                {(job.status === 'failed' || job.status === 'skipped') && job.error_message && (
                  <p className="mt-1 text-xs text-red-600 max-w-xs break-words">{job.error_message}</p>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{job.items_extracted}</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                {job.accuracy_score != null ? `${job.accuracy_score.toFixed(1)}%` : '—'}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {job.uploaded_by ? job.uploaded_by.split('@')[0] : '—'}
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                <div>{new Date(job.created_at).toLocaleDateString()}</div>
                <div className="text-xs text-gray-400">
                  {new Date(job.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {job.pdf_path && (
                    <a href={`/api/jobs/${job.job_id}/pdf`} className="text-brand-600 hover:underline font-medium">
                      View PDF
                    </a>
                  )}
                  {(job.status === 'completed' || job.status === 'completed_with_warnings') && (
                    <a href={`/api/jobs/${job.job_id}/download`} className="text-green-600 hover:underline font-medium">
                      Download Excel
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({
  page, totalPages, total, start, end, onPage,
}: {
  page: number
  totalPages: number
  total: number
  start: number
  end: number
  onPage: (p: number) => void
}) {
  // Build page number list — always show first, last, current ±1, with ellipsis gaps
  const pages: (number | '…')[] = []
  const range = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages))
  const sorted = [...range].sort((a, b) => a - b)
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) pages.push('…')
    pages.push(p)
  })

  const btnBase = 'min-w-[36px] h-9 px-3 text-sm font-medium rounded-lg border transition-colors'
  const btnActive = 'text-white border-transparent'
  const btnInactive = 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
  const btnDisabled = 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'

  return (
    <div className="flex items-center justify-between px-1 pt-1">
      <p className="text-sm text-gray-500">
        Showing {start + 1}–{end} of {total} request{total !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
        >
          ← Prev
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-gray-400 text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
              style={p === page ? { backgroundColor: '#1F4993' } : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
