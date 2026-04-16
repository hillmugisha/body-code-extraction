"""Accuracy scoring and correction analysis."""

import logging
import uuid
from typing import Optional
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config
import pipeline.db as db

logger = logging.getLogger(__name__)


def compute_pre_score(items: list) -> float:
    """Confidence-weighted pre-score before any human corrections."""
    if not items:
        return 0.0
    weights = config.CONFIDENCE_WEIGHTS
    total = sum(weights.get(getattr(i, "confidence", "low"), 0.6) for i in items)
    return round(total / len(items) * 100, 2)


def save_job_snapshot(job_id: str) -> dict:
    """Compute and persist an accuracy snapshot for a completed job."""
    stats = db.get_accuracy_stats(job_id=job_id)
    snapshot_id = str(uuid.uuid4())
    db.insert_accuracy_snapshot(
        snapshot_id=snapshot_id,
        job_id=job_id,
        total_items=stats["total_items"],
        corrected_items=stats["corrected_items"],
        accuracy_score=stats["accuracy_score"],
        snapshot_type="per_job",
    )
    return stats


def save_aggregate_snapshot() -> dict:
    """Compute and persist an aggregate accuracy snapshot across all jobs."""
    stats = db.get_accuracy_stats(job_id=None)
    snapshot_id = str(uuid.uuid4())
    db.insert_accuracy_snapshot(
        snapshot_id=snapshot_id,
        job_id=None,
        total_items=stats["total_items"],
        corrected_items=stats["corrected_items"],
        accuracy_score=stats["accuracy_score"],
        snapshot_type="aggregate",
    )
    return stats
