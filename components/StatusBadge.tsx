import type { Job } from '@/lib/supabase'

const styles: Record<Job['status'], string> = {
  running:                  'bg-yellow-100 text-yellow-800',
  completed:                'bg-green-100 text-green-800',
  completed_with_warnings:  'bg-green-100 text-green-800',
  failed:                   'bg-red-100 text-red-800',
  skipped:                  'bg-red-100 text-red-800',
}

const labels: Record<Job['status'], string> = {
  running:                  'In Progress',
  completed:                'Finished',
  completed_with_warnings:  'Finished',
  failed:                   'Failed',
  skipped:                  'Failed',
}

export default function StatusBadge({ status }: { status: Job['status'] }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
