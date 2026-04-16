"""Batch PDF orchestrator."""

import logging
import uuid
from pathlib import Path
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config
import pipeline.db as db
from pipeline.extractor import extract_from_pdf, ExtractionResult
from pipeline.excel_writer import write_populated_workbook, build_output_path
from pipeline.accuracy import compute_pre_score, save_job_snapshot, save_aggregate_snapshot

logger = logging.getLogger(__name__)


def scan_input_folder(input_dir: str | None = None) -> list[str]:
    """Return list of PDF paths not yet successfully processed."""
    folder = Path(input_dir or config.INPUT_DIR)
    all_pdfs = list(folder.glob("*.pdf"))
    completed = db.get_completed_filenames()
    return [str(p) for p in all_pdfs if p.name not in completed]


def process_single_pdf(pdf_path: str, job_id: str | None = None, uploaded_by: str | None = None, environment: str = "development", storage_pdf_path: str | None = None) -> dict:
    """
    Full pipeline for one PDF:
      1. Insert job (running)
      2. Extract via Claude Vision
      3. Write populated Excel
      4. Update job (completed/failed)
      5. Save accuracy snapshot
    Returns a job summary dict.
    """
    job_id = job_id or str(uuid.uuid4())
    pdf_name = Path(pdf_path).name
    template_used = str(config.TEMPLATE_PATH)

    db.insert_job(
        job_id=job_id,
        pdf_filename=pdf_name,
        pdf_path=storage_pdf_path or pdf_path,
        template_used=template_used,
        status="running",
        uploaded_by=uploaded_by,
        environment=environment,
    )
    logger.info(f"[{job_id}] Started: {pdf_name}")

    try:
        # --- Extraction ---
        result: ExtractionResult = extract_from_pdf(pdf_path, job_id)

        if result.error == "section_not_found":
            db.update_job_status(job_id, "skipped", error_message="section_not_found")
            return {"job_id": job_id, "status": "skipped", "pdf": pdf_name}

        if result.error:
            db.update_job_status(job_id, "failed", error_message=result.error)
            return {"job_id": job_id, "status": "failed", "pdf": pdf_name, "error": result.error}

        # --- Persist items to Supabase ---
        pre_score = compute_pre_score(result.items)
        items_payload = [
            {
                "item_id": str(uuid.uuid4()),
                "job_id": job_id,
                "sequence_order": idx,
                "code": item.code,
                "description": item.description,
                "msrp": item.msrp,
                "page_number": item.page_number,
                "confidence": item.confidence,
            }
            for idx, item in enumerate(result.items)
        ]
        db.bulk_insert_items(items_payload)

        # --- Write Excel ---
        output_path = build_output_path(pdf_path)
        write_populated_workbook(result, output_path)

        # --- Upload Excel to Supabase Storage ---
        excel_bytes = Path(output_path).read_bytes()
        storage_output_path = db.upload_to_storage(
            bucket="outputs",
            path=f"{job_id}/{Path(output_path).name}",
            data=excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        # --- Update job status ---
        final_status = "completed_with_warnings" if result.warnings else "completed"
        base_vehicle = result.items[0].code if result.items and result.items[0].code else None
        db.update_job_status(
            job_id=job_id,
            status=final_status,
            items_extracted=len(result.items),
            vehicle_title=result.vehicle_title,
            base_vehicle=base_vehicle,
            output_path=storage_output_path,
            page_range_start=result.page_range[0],
            page_range_end=result.page_range[1],
        )

        # --- Accuracy snapshot ---
        save_job_snapshot(job_id)
        save_aggregate_snapshot()

        summary = {
            "job_id": job_id,
            "status": final_status,
            "pdf": pdf_name,
            "vehicle_title": result.vehicle_title,
            "items_extracted": len(result.items),
            "pre_score": pre_score,
            "output_path": output_path,
            "warnings": result.warnings,
        }
        logger.info(f"[{job_id}] Done: {len(result.items)} items, pre_score={pre_score}%")
        return summary

    except Exception as e:
        logger.error(f"[{job_id}] Fatal error: {e}", exc_info=True)
        db.update_job_status(job_id, "failed", error_message=str(e))
        return {"job_id": job_id, "status": "failed", "pdf": pdf_name, "error": str(e)}


def run_batch(input_dir: str | None = None) -> list[dict]:
    """Process all unprocessed PDFs in the input folder."""
    pdfs = scan_input_folder(input_dir)
    if not pdfs:
        logger.info("No new PDFs to process.")
        return []

    logger.info(f"Found {len(pdfs)} PDF(s) to process.")
    results = []
    for pdf_path in pdfs:
        summary = process_single_pdf(pdf_path, environment=config.ENVIRONMENT)
        results.append(summary)
    return results
