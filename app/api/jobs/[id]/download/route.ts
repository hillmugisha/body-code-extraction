import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { supabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const { data: job, error } = await supabase
    .from('jobs')
    .select('output_path, pdf_filename')
    .eq('job_id', id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  if (!job.output_path) {
    return NextResponse.json({ error: 'Output file not yet available' }, { status: 404 })
  }

  try {
    const fileBuffer = await readFile(job.output_path)
    const filename = job.output_path.split(/[\\/]/).pop() ?? 'output.xlsx'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }
}
