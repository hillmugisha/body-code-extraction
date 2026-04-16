import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'hill.mugisha@pritchards.com'

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email') ?? ''
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL

  // Fetch jobs and latest per-job accuracy snapshots in parallel
  const jobsQuery = isAdmin
    ? supabase.from('jobs').select('*').order('created_at', { ascending: false })
    : supabase.from('jobs').select('*').eq('uploaded_by', email).order('created_at', { ascending: false })

  const [jobsRes, snapRes] = await Promise.all([
    jobsQuery,
    supabase
      .from('accuracy_snapshots')
      .select('job_id, accuracy_score, snapshot_at')
      .eq('snapshot_type', 'per_job')
      .order('snapshot_at', { ascending: false }),
  ])

  if (jobsRes.error) {
    return NextResponse.json({ error: jobsRes.error.message }, { status: 500 })
  }

  // Build a map of job_id → latest accuracy_score
  const accuracyMap = new Map<string, number>()
  for (const snap of snapRes.data ?? []) {
    if (snap.job_id && !accuracyMap.has(snap.job_id)) {
      accuracyMap.set(snap.job_id, snap.accuracy_score)
    }
  }

  // Attach accuracy_score to each job
  const jobs = (jobsRes.data ?? []).map((job) => ({
    ...job,
    accuracy_score: accuracyMap.get(job.job_id) ?? null,
  }))

  return NextResponse.json(jobs, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
