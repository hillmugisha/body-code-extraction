-- Run this once in your Supabase SQL editor to set up all tables.
-- Dashboard: https://supabase.com/dashboard/project/qtffqvtetznvoujvxmfx/sql

CREATE TABLE IF NOT EXISTS jobs (
    job_id           TEXT PRIMARY KEY,
    pdf_filename     TEXT NOT NULL,
    pdf_path         TEXT,
    template_used    TEXT NOT NULL,
    output_path      TEXT,
    status           TEXT CHECK(status IN ('running','completed','failed','skipped','completed_with_warnings')),
    items_extracted  INTEGER DEFAULT 0,
    vehicle_title    TEXT,
    page_range_start INTEGER,
    page_range_end   INTEGER,
    error_message    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS extraction_items (
    item_id        TEXT PRIMARY KEY,
    job_id         TEXT NOT NULL REFERENCES jobs(job_id),
    sequence_order INTEGER NOT NULL,
    code           TEXT NOT NULL,
    description    TEXT NOT NULL,
    msrp           TEXT,
    page_number    INTEGER,
    confidence     TEXT CHECK(confidence IN ('high','medium','low')),
    is_corrected   BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS corrections (
    correction_id        TEXT PRIMARY KEY,
    item_id              TEXT NOT NULL REFERENCES extraction_items(item_id),
    job_id               TEXT NOT NULL,
    original_code        TEXT,
    original_description TEXT,
    corrected_code       TEXT,
    corrected_description TEXT,
    corrected_by         TEXT DEFAULT 'manual',
    corrected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accuracy_snapshots (
    snapshot_id     TEXT PRIMARY KEY,
    job_id          TEXT REFERENCES jobs(job_id),
    snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_items     INTEGER,
    corrected_items INTEGER,
    accuracy_score  FLOAT,
    snapshot_type   TEXT CHECK(snapshot_type IN ('per_job','aggregate'))
);
