import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { data: job } = await supabaseServer
    .from('jobs')
    .select('pdf_path, pdf_filename')
    .eq('job_id', params.id)
    .single()

  if (!job?.pdf_path) {
    return NextResponse.json({ error: 'PDF not available' }, { status: 404 })
  }

  const { data, error } = await supabaseServer.storage
    .from('pdfs')
    .createSignedUrl(job.pdf_path, 120)

  if (error || !data) {
    return NextResponse.json({ error: 'Could not generate PDF link' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
