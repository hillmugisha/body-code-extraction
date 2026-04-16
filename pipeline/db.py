"""Supabase CRUD operations for the extraction pipeline."""

import time
import logging
from typing import Optional
from supabase import create_client, Client
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
    return _client


def upload_to_storage(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """Upload bytes to Supabase Storage. Returns the storage path."""
    client = get_client()
    try:
        response = client.storage.from_(bucket).upload(
            path=path,
            file=data,
            file_options={"content-type": content_type, "upsert": True},
        )
        logger.info(f"Storage upload to {bucket}/{path} succeeded: {response}")
    except Exception as e:
        logger.error(f"Storage upload to {bucket}/{path} failed: {e}")
        raise
    return path


def _retry(fn, retries: int = 3, delay: float = 0.5):
    """Run fn with retries on exception."""
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            if attempt == retries - 1:
                raise
            logger.warning(f"Supabase call failed (attempt {attempt + 1}): {e}. Retrying...")
            time.sleep(delay)


def insert_job(
    job_id: str,
    pdf_filename: str,
    pdf_path: str,
    template_used: str,
    status: str = "running",
    uploaded_by: Optional[str] = None,
    environment: str = "development",
) -> None:
    client = get_client()
    payload: dict = {
        "job_id": job_id,
        "pdf_filename": pdf_filename,
        "pdf_path": pdf_path,
        "template_used": template_used,
        "status": status,
        "environment": environment,
    }
    if uploaded_by:
        payload["uploaded_by"] = uploaded_by
    _retry(lambda: client.table("jobs").insert(payload).execute())


def update_job_status(
    job_id: str,
    status: str,
    items_extracted: int = 0,
    vehicle_title: Optional[str] = None,
    base_vehicle: Optional[str] = None,
    output_path: Optional[str] = None,
    page_range_start: Optional[int] = None,
    page_range_end: Optional[int] = None,
    error_message: Optional[str] = None,
) -> None:
    client = get_client()
    from datetime import datetime, timezone
    payload: dict = {
        "status": status,
        "items_extracted": items_extracted,
    }
    if vehicle_title is not None:
        payload["vehicle_title"] = vehicle_title
    if base_vehicle is not None:
        payload["base_vehicle"] = base_vehicle
    if output_path is not None:
        payload["output_path"] = output_path
    if page_range_start is not None:
        payload["page_range_start"] = page_range_start
    if page_range_end is not None:
        payload["page_range_end"] = page_range_end
    if error_message is not None:
        payload["error_message"] = error_message
    if status in ("completed", "failed", "skipped", "completed_with_warnings"):
        payload["completed_at"] = datetime.now(timezone.utc).isoformat()

    _retry(lambda: client.table("jobs").update(payload).eq("job_id", job_id).execute())


def bulk_insert_items(items: list[dict]) -> None:
    if not items:
        return
    client = get_client()
    _retry(lambda: client.table("extraction_items").insert(items).execute())


def insert_correction(
    correction_id: str,
    item_id: str,
    job_id: str,
    original_code: str,
    original_description: str,
    corrected_code: str,
    corrected_description: str,
    corrected_by: str = "manual",
) -> None:
    client = get_client()
    _retry(lambda: client.table("corrections").insert({
        "correction_id": correction_id,
        "item_id": item_id,
        "job_id": job_id,
        "original_code": original_code,
        "original_description": original_description,
        "corrected_code": corrected_code,
        "corrected_description": corrected_description,
        "corrected_by": corrected_by,
    }).execute())
    # Mark item as corrected
    _retry(lambda: client.table("extraction_items")
           .update({"is_corrected": True})
           .eq("item_id", item_id)
           .execute())


def insert_accuracy_snapshot(
    snapshot_id: str,
    job_id: Optional[str],
    total_items: int,
    corrected_items: int,
    accuracy_score: float,
    snapshot_type: str,
) -> None:
    client = get_client()
    _retry(lambda: client.table("accuracy_snapshots").insert({
        "snapshot_id": snapshot_id,
        "job_id": job_id,
        "total_items": total_items,
        "corrected_items": corrected_items,
        "accuracy_score": accuracy_score,
        "snapshot_type": snapshot_type,
    }).execute())


def get_job(job_id: str) -> Optional[dict]:
    client = get_client()
    result = _retry(lambda: client.table("jobs").select("*").eq("job_id", job_id).execute())
    return result.data[0] if result.data else None


def get_items_for_job(job_id: str) -> list[dict]:
    client = get_client()
    result = _retry(lambda: client.table("extraction_items")
                    .select("*")
                    .eq("job_id", job_id)
                    .order("sequence_order")
                    .execute())
    return result.data or []


def get_all_jobs() -> list[dict]:
    client = get_client()
    result = _retry(lambda: client.table("jobs")
                    .select("*")
                    .order("created_at", desc=True)
                    .execute())
    return result.data or []


def get_completed_filenames() -> set[str]:
    """Return set of pdf_filenames already successfully processed."""
    client = get_client()
    result = _retry(lambda: client.table("jobs")
                    .select("pdf_filename")
                    .eq("status", "completed")
                    .execute())
    return {row["pdf_filename"] for row in (result.data or [])}


def get_accuracy_stats(job_id: Optional[str] = None) -> dict:
    client = get_client()
    if job_id:
        items_res = _retry(lambda: client.table("extraction_items")
                           .select("item_id, confidence, is_corrected")
                           .eq("job_id", job_id)
                           .execute())
    else:
        items_res = _retry(lambda: client.table("extraction_items")
                           .select("item_id, confidence, is_corrected")
                           .execute())

    items = items_res.data or []
    total = len(items)
    corrected = sum(1 for i in items if i.get("is_corrected"))
    accuracy = round((total - corrected) / total * 100, 2) if total else 0.0

    weights = config.CONFIDENCE_WEIGHTS
    pre_score = round(
        sum(weights.get(i.get("confidence", "low"), 0.6) for i in items) / total * 100, 2
    ) if total else 0.0

    return {
        "job_id": job_id,
        "total_items": total,
        "corrected_items": corrected,
        "accuracy_score": accuracy,
        "pre_score": pre_score,
    }
