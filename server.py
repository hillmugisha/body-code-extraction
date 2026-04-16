"""FastAPI HTTP server wrapping the Body Code Extraction pipeline."""

import logging
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

# Configure logging before importing pipeline modules
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

from fastapi import FastAPI, File, Form, UploadFile, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

import config
import pipeline.db as db
from pipeline.watcher import process_single_pdf

# Ensure runtime directories exist on startup
config.INPUT_DIR.mkdir(parents=True, exist_ok=True)
config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Body Code Extraction Service")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract")
async def extract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_id: str = Form(...),
    uploaded_by: str = Form(None),
    environment: str = Form('production'),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    dest_path = config.INPUT_DIR / file.filename
    contents = await file.read()
    dest_path.write_bytes(contents)

    background_tasks.add_task(
        process_single_pdf,
        str(dest_path),
        job_id=job_id,
        uploaded_by=uploaded_by,
        environment=environment,
    )

    return {"job_id": job_id, "filename": file.filename}


@app.get("/files/output/{job_id}")
def download_output(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    output_path = job.get("output_path")
    if not output_path or not Path(output_path).exists():
        raise HTTPException(status_code=404, detail="Output file not available")
    filename = Path(output_path).name
    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/files/pdf/{job_id}")
def view_pdf(job_id: str):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    pdf_path = job.get("pdf_path")
    if not pdf_path or not Path(pdf_path).exists():
        raise HTTPException(status_code=404, detail="PDF not available")
    filename = job.get("pdf_filename") or Path(pdf_path).name
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
