import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const [jobRes, itemsRes] = await Promise.all([
    supabase.from('jobs').select('*').eq('job_id', id).single(),
    supabase
      .from('extraction_items')
      .select('*')
      .eq('job_id', id)
      .order('sequence_order'),
  ])

  if (jobRes.error) {
    return NextResponse.json({ error: jobRes.error.message }, { status: 404 })
  }

  return NextResponse.json({ job: jobRes.data, items: itemsRes.data ?? [] })
}
