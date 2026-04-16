"""CLI entry point for the Body Code Extraction pipeline."""

import logging
import sys
import uuid
from pathlib import Path

# Ensure stdout handles Unicode on Windows terminals
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore[attr-defined]
    except Exception:
        pass

import click
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

try:
    from config import LOG_PATH
    fh = logging.FileHandler(str(LOG_PATH), encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    logging.getLogger().addHandler(fh)
except Exception:
    pass

import pipeline.db as db
from pipeline.watcher import process_single_pdf, run_batch, scan_input_folder
from pipeline.accuracy import save_job_snapshot, save_aggregate_snapshot


@click.group()
def cli():
    """Body Code Extraction Pipeline"""


@cli.command()
@click.argument("input_path")
@click.option("--output-dir", default=None, help="Override output directory")
@click.option("--job-id", default=None, help="Use a pre-assigned job ID (set by the web API)")
@click.option("--uploaded-by", default=None, help="Email of the user who uploaded the file")
def run(input_path, output_dir, job_id, uploaded_by):
    """Process a single PDF or all PDFs in a folder."""
    path = Path(input_path)

    if output_dir:
        import config
        config.OUTPUT_DIR = Path(output_dir)

    if path.is_file():
        if path.suffix.lower() != ".pdf":
            click.echo(f"Error: {path} is not a PDF file.", err=True)
            sys.exit(1)
        summary = process_single_pdf(str(path), job_id=job_id, uploaded_by=uploaded_by)
        _print_summary(summary)
    elif path.is_dir():
        results = run_batch(str(path))
        if not results:
            click.echo("No new PDFs found to process.")
        for s in results:
            _print_summary(s)
    else:
        click.echo(f"Error: {path} does not exist.", err=True)
        sys.exit(1)


@cli.command()
@click.option("--job-id", default=None, help="Show details for a specific job")
def status(job_id):
    """Show extraction job status."""
    if job_id:
        job = db.get_job(job_id)
        if not job:
            click.echo(f"Job {job_id} not found.")
            return
        _print_job(job)
    else:
        jobs = db.get_all_jobs()
        if not jobs:
            click.echo("No jobs found.")
            return
        click.echo(f"\n{'JOB ID':<38} {'STATUS':<28} {'ITEMS':>5} {'PDF FILENAME'}")
        click.echo("-" * 100)
        for j in jobs:
            click.echo(
                f"{j['job_id']:<38} {j['status']:<28} {j.get('items_extracted', 0):>5}  {j['pdf_filename']}"
            )


@cli.command()
@click.option("--job-id", default=None, help="Accuracy for a specific job; omit for aggregate")
def accuracy(job_id):
    """Print accuracy report."""
    stats = db.get_accuracy_stats(job_id=job_id)
    label = f"Job {job_id}" if job_id else "Aggregate (all jobs)"
    click.echo(f"\n=== Accuracy Report: {label} ===")
    click.echo(f"  Total items:     {stats['total_items']}")
    click.echo(f"  Corrected items: {stats['corrected_items']}")
    click.echo(f"  Accuracy score:  {stats['accuracy_score']}%")
    click.echo(f"  Pre-score:       {stats['pre_score']}%")


@cli.command()
@click.argument("item_id")
@click.argument("corrected_code")
@click.argument("corrected_description")
@click.option("--by", default="manual", help="Who made the correction")
def correct(item_id, corrected_code, corrected_description, by):
    """Record a manual correction for an extracted item."""
    items = db.get_client().table("extraction_items").select("*").eq("item_id", item_id).execute()
    if not items.data:
        click.echo(f"Item {item_id} not found.", err=True)
        sys.exit(1)
    item = items.data[0]
    correction_id = str(uuid.uuid4())
    db.insert_correction(
        correction_id=correction_id,
        item_id=item_id,
        job_id=item["job_id"],
        original_code=item["code"],
        original_description=item["description"],
        corrected_code=corrected_code,
        corrected_description=corrected_description,
        corrected_by=by,
    )
    click.echo(f"Correction recorded: {correction_id}")
    # Refresh accuracy snapshot
    save_job_snapshot(item["job_id"])
    save_aggregate_snapshot()


@cli.command()
def reprocess():
    """Re-run extraction on all failed jobs."""
    client = db.get_client()
    failed = client.table("jobs").select("job_id, pdf_path, pdf_filename").eq("status", "failed").execute()
    if not failed.data:
        click.echo("No failed jobs found.")
        return
    for job in failed.data:
        pdf_path = job.get("pdf_path") or job.get("pdf_filename")
        if not pdf_path or not Path(pdf_path).exists():
            click.echo(f"Skipping {job['job_id']}: PDF not found at {pdf_path}")
            continue
        click.echo(f"Reprocessing: {job['pdf_filename']} ...")
        summary = process_single_pdf(pdf_path)
        _print_summary(summary)


def _print_summary(summary: dict) -> None:
    status = summary.get("status", "unknown")
    pdf = summary.get("pdf", "")
    job_id = summary.get("job_id", "")
    items = summary.get("items_extracted", 0)
    score = summary.get("pre_score", "N/A")
    title = summary.get("vehicle_title", "")
    output = summary.get("output_path", "")
    err = summary.get("error", "")

    click.echo(f"\n{'-'*60}")
    click.echo(f"  Job ID:  {job_id}")
    click.echo(f"  File:    {pdf}")
    click.echo(f"  Status:  {status}")
    if title:
        click.echo(f"  Title:   {title}")
    if items:
        click.echo(f"  Items:   {items}")
    if score != "N/A":
        click.echo(f"  Pre-score: {score}%")
    if output:
        click.echo(f"  Output:  {output}")
    if err:
        click.echo(f"  Error:   {err}")
    warnings = summary.get("warnings", [])
    for w in warnings:
        click.echo(f"  Warning: {w}")


def _print_job(job: dict) -> None:
    for k, v in job.items():
        click.echo(f"  {k}: {v}")


if __name__ == "__main__":
    cli()
