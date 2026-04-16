import { NextResponse } from 'next/server'

const PIPELINE_URL = process.env.PIPELINE_SERVICE_URL

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!PIPELINE_URL) {
    return NextResponse.json({ error: 'Pipeline service not configured' }, { status: 503 })
  }

  const res = await fetch(`${PIPELINE_URL}/files/output/${params.id}`)

  if (!res.ok) {
    return NextResponse.json({ error: 'File not available' }, { status: res.status })
  }

  const buffer = await res.arrayBuffer()
  const contentDisposition =
    res.headers.get('content-disposition') ?? 'attachment; filename="output.xlsx"'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': contentDisposition,
    },
  })
}
