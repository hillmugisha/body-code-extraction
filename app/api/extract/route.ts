import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { spawn, spawnSync } from 'child_process'

const INPUT_DIR = join(process.cwd(), 'input')
const PYTHON_SCRIPT = join(process.cwd(), 'main.py')

/** Find the Python executable available on this machine. */
function getPythonExe(): string {
  for (const candidate of ['python3', 'python', 'py']) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
    if (result.status === 0) return candidate
  }
  return 'python3' // fallback
}

const PYTHON_EXE = getPythonExe()

export async function POST(request: NextRequest) {
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

    // Generate job_id here so the browser can track this exact job
    const jobId = randomUUID()

    // Save uploaded PDF to input/
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const destPath = join(INPUT_DIR, file.name)
    await writeFile(destPath, buffer)

    // Spawn Python pipeline with the pre-generated job_id and uploader email
    const args = [PYTHON_SCRIPT, 'run', destPath, '--job-id', jobId]
    if (uploadedBy) args.push('--uploaded-by', uploadedBy)

    const child = spawn(PYTHON_EXE, args, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
      windowsHide: true,
    })
    child.unref()

    return NextResponse.json({ job_id: jobId, filename: file.name })
  } catch (err) {
    console.error('/api/extract error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
