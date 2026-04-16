import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL

export async function POST(request: NextRequest) {
  if (!PIPELINE_URL) {
    return NextResponse.json({ error: 'Pipeline service not configured' }, { status: 503 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const uploadedBy = formData.get('uploaded_by') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    const jobId = randomUUID()

    const serviceForm = new FormData()
    serviceForm.append('file', file)
    serviceForm.append('job_id', jobId)
    if (uploadedBy) serviceForm.append('uploaded_by', uploadedBy)
    serviceForm.append('environment', process.env.NODE_ENV === 'production' ? 'production' : 'development')

    const res = await fetch(`${PIPELINE_URL}/extract`, {
      method: 'POST',
      body: serviceForm,
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    return NextResponse.json({ job_id: jobId, filename: file.name })
  } catch (err) {
    console.error('/api/extract error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
