'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { Job } from '@/lib/supabase'
import StatusBadge from './StatusBadge'

const PAGE_SIZE = 10

interface JobsTableProps {
  jobs: Job[]
  limit?: number
}

export default function JobsTable({ jobs, limit }: JobsTableProps) {
  const [page, setPage] = useState(1)

  if (limit !== undefined) {
    const displayed = jobs.slice(0, limit)
    if (displayed.length === 0) return <EmptyState />
    return <Table rows={displayed} />
  }

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

const HEADERS: { label: string; align: 'left' | 'right' }[] = [
  { label: 'PDF Filename',  align: 'left'  },
  { label: 'Base Vehicle',  align: 'left'  },
  { label: 'Vehicle Title', align: 'left'  },
  { label: 'Status',        align: 'left'  },
  { label: 'Items',         align: 'right' },
  { label: 'Accuracy',      align: 'right' },
  { label: 'Uploaded By',   align: 'left'  },
  { label: 'Date',          align: 'left'  },
  { label: 'Actions',       align: 'left'  },
]

const DEFAULT_WIDTHS = [180, 100, 220, 130, 70, 85, 110, 120, 160]

function Table({ rows }: { rows: Job[] }) {
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_WIDTHS)
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null)

  const onResizeStart = useCallback((col: number, e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = { col, startX: e.clientX, startW: colWidths[col] }

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const delta = ev.clientX - resizing.current.startX
      const newW = Math.max(50, resizing.current.startW + delta)
      setColWidths(prev => {
        const next = [...prev]
        next[resizing.current!.col] = newW
        return next
      })
    }

    const onUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colWidths])

  const totalWidth = colWidths.reduce((a, b) => a + b, 0)

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table
        className="divide-y divide-gray-200 text-sm"
        style={{ tableLayout: 'fixed', width: totalWidth, minWidth: '100%' }}
      >
        <thead className="bg-gray-50">
          <tr>
            {HEADERS.map((h, i) => (
              <th
                key={h.label}
                style={{ width: colWidths[i], position: 'relative' }}
                className={`px-4 py-3 font-bold text-blue-700 select-none ${h.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {h.label}
                {/* Resize handle */}
                <span
                  onMouseDown={(e) => onResizeStart(i, e)}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize group flex items-center justify-center"
                  title="Drag to resize"
                >
                  <span className="w-px h-4 bg-blue-200 group-hover:bg-blue-500 transition-colors" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((job) => (
            <tr key={job.job_id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs truncate" title={job.pdf_filename}>
                <Link href={`/jobs/${job.job_id}`} className="text-brand-600 hover:underline">
                  {job.pdf_filename}
                </Link>
              </td>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 truncate">
                {job.base_vehicle ?? '—'}
              </td>
              <td className="px-4 py-3 text-gray-700 truncate" title={job.vehicle_title ?? ''}>
                {job.vehicle_title ?? '—'}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={job.status} />
                {(job.status === 'failed' || job.status === 'skipped') && job.error_message && (
                  <p className="mt-1 text-xs text-red-600 break-words">{job.error_message}</p>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{job.items_extracted}</td>
              <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                {job.accuracy_score != null ? `${job.accuracy_score.toFixed(1)}%` : '—'}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs truncate">
                {job.uploaded_by ? job.uploaded_by.split('@')[0] : '—'}
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                <div>{new Date(job.created_at).toLocaleDateString()}</div>
                <div className="text-xs text-gray-400">
                  {new Date(job.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {job.pdf_path && (
                    <a href={`/api/jobs/${job.job_id}/pdf`} className="text-brand-600 hover:underline font-medium whitespace-nowrap">
                      View PDF
                    </a>
                  )}
                  {(job.status === 'completed' || job.status === 'completed_with_warnings') && (
                    <a href={`/api/jobs/${job.job_id}/download`} className="text-green-600 hover:underline font-medium whitespace-nowrap">
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
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
      <p className="text-sm text-gray-500">
        Showing {start + 1}–{end} of {total} request{total !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
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
