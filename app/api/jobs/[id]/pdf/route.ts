import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { supabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('pdf_path, pdf_filename')
    .eq('job_id', params.id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  if (!job.pdf_path) {
    return NextResponse.json({ error: 'PDF path not recorded for this job' }, { status: 404 })
  }

  try {
    const fileBuffer = await readFile(job.pdf_path)
    const filename = job.pdf_filename ?? 'document.pdf'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'PDF file not found on disk' }, { status: 404 })
  }
}
