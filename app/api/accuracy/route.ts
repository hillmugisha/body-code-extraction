import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('job_id')

  let query = supabase
    .from('extraction_items')
    .select('item_id, confidence, is_corrected, job_id')

  if (jobId) query = query.eq('job_id', jobId)

  const { data: items, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const total = items?.length ?? 0
  const corrected = items?.filter((i) => i.is_corrected).length ?? 0
  const accuracy = total > 0 ? Math.round(((total - corrected) / total) * 10000) / 100 : 0

  const weights: Record<string, number> = { high: 1.0, medium: 0.85, low: 0.6 }
  const preScore =
    total > 0
      ? Math.round(
          (items!.reduce((sum, i) => sum + (weights[i.confidence] ?? 0.6), 0) / total) * 10000
        ) / 100
      : 0

  return NextResponse.json({
    job_id: jobId ?? null,
    total_items: total,
    corrected_items: corrected,
    accuracy_score: accuracy,
    pre_score: preScore,
  })
}
