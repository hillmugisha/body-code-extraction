'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Link from 'next/link'
import type { Job } from '@/lib/supabase'
import StatusBadge from './StatusBadge'
import { useAuth } from '@/context/AuthContext'

type UploadPhase = 'idle' | 'uploading' | 'polling' | 'done_success' | 'done_warnings' | 'done_failed' | 'error'

const TERMINAL_STATUSES = new Set(['completed', 'completed_with_warnings', 'failed', 'skipped'])
const POLL_INTERVAL_MS = 3000

const statusMessage: Record<string, string> = {
  running: 'Extraction in progress — Claude is reading the PDF...',
  completed: 'Success! The Excel file is ready to download.',
  completed_with_warnings: 'Done with warnings — review the job for details.',
  failed: 'Extraction failed. Check the job detail page for the error.',
  skipped: 'Job was skipped — the "As Configured Vehicle" section may not have been found.',
}

export default function UploadDropzone() {
  const { userEmail } = useAuth()
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [uploadedFilename, setUploadedFilename] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Poll a specific job by ID — stops the instant the job reaches a terminal state
  const startPolling = useCallback((jobId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const job: Job = data.job
        if (!job) return
        setJob(job)
        if (TERMINAL_STATUSES.has(job.status)) {
          stopPolling()
          if (job.status === 'completed') setPhase('done_success')
          else if (job.status === 'completed_with_warnings') setPhase('done_warnings')
          else setPhase('done_failed')
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS)
  }, [])

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    const file = acceptedFiles[0]
    setPhase('uploading')
    setErrorMsg('')
    setJob(null)
    setUploadedFilename(file.name)

    const formData = new FormData()
    formData.append('file', file)
    if (userEmail) formData.append('uploaded_by', userEmail)

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        setPhase('polling')
        startPolling(data.job_id)
      } else {
        setPhase('error')
        setErrorMsg(data.error ?? 'Upload failed.')
      }
    } catch {
      setPhase('error')
      setErrorMsg('Network error. Please try again.')
    }
  }, [startPolling])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: phase === 'uploading' || phase === 'polling',
  })

  const isActive = phase === 'uploading' || phase === 'polling'

  const reset = () => {
    stopPolling()
    setPhase('idle')
    setErrorMsg('')
    setJob(null)
    setUploadedFilename('')
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={[
          'border-2 border-dashed rounded-xl p-10 text-center transition-colors',
          isDragActive ? 'border-brand-500 bg-brand-50 cursor-copy' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50 cursor-pointer',
          isActive ? 'opacity-50 pointer-events-none' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {isDragActive ? (
            <p className="text-brand-600 font-medium">Drop your PDF here</p>
          ) : (
            <>
              <p className="text-gray-600 font-medium">Drag & drop a PDF, or click to browse</p>
              <p className="text-sm text-gray-400">Ford vehicle specification files only (.pdf)</p>
            </>
          )}
        </div>
      </div>

      {/* Status panel — shown after upload */}
      {phase !== 'idle' && phase !== 'error' && (
        <div className={[
          'rounded-lg border px-4 py-4 text-sm space-y-3',
          phase === 'done_success' ? 'bg-green-50 border-green-200' :
          phase === 'done_warnings' ? 'bg-orange-50 border-orange-200' :
          phase === 'done_failed' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200',
        ].join(' ')}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Spinner while polling */}
              {(phase === 'uploading' || phase === 'polling') && (
                <svg className="animate-spin h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {/* Check icon on success */}
              {phase === 'done_success' && (
                <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="font-medium text-gray-800 truncate max-w-xs">{uploadedFilename}</span>
            </div>
            {job && <StatusBadge status={job.status} />}
          </div>

          <p className={[
            'text-sm',
            phase === 'done_success' ? 'text-green-800' :
            phase === 'done_warnings' ? 'text-orange-800' :
            phase === 'done_failed' ? 'text-red-800' :
            'text-blue-800',
          ].join(' ')}>
            {phase === 'uploading' && 'Uploading file...'}
            {phase === 'polling' && (job ? statusMessage[job.status] : 'Waiting for extraction to start...')}
            {(phase === 'done_success' || phase === 'done_warnings') && 'Finished — see the table below for details.'}
            {phase === 'done_failed' && (job?.error_message ? `Error: ${job.error_message}` : statusMessage['failed'])}
          </p>

          <div className="flex items-center gap-3">
            {job && (
              <Link
                href={`/jobs/${job.job_id}`}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                View job details →
              </Link>
            )}
            {(phase === 'done_success' || phase === 'done_warnings' || phase === 'done_failed') && (
              <button
                onClick={reset}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Upload another
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error panel */}
      {phase === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button onClick={reset} className="text-xs underline text-red-600 hover:text-red-800 shrink-0">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
