import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    // Force every internal Supabase fetch to bypass Next.js data cache
    fetch: (url: RequestInfo | URL, init?: RequestInit) =>
      fetch(url, { ...init, cache: 'no-store' }),
  },
})

// Types matching the database schema
export interface Job {
  job_id: string
  pdf_filename: string
  pdf_path: string | null
  template_used: string
  output_path: string | null
  status: 'running' | 'completed' | 'failed' | 'skipped' | 'completed_with_warnings'
  items_extracted: number
  vehicle_title: string | null
  page_range_start: number | null
  page_range_end: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  accuracy_score?: number | null
  base_vehicle?: string | null
  uploaded_by?: string | null
}

export interface ExtractionItem {
  item_id: string
  job_id: string
  sequence_order: number
  code: string
  description: string
  msrp: string | null
  page_number: number | null
  confidence: 'high' | 'medium' | 'low'
  is_corrected: boolean
  created_at: string
}

export interface Correction {
  correction_id: string
  item_id: string
  job_id: string
  original_code: string | null
  original_description: string | null
  corrected_code: string | null
  corrected_description: string | null
  corrected_by: string
  corrected_at: string
}

export interface AccuracySnapshot {
  snapshot_id: string
  job_id: string | null
  snapshot_at: string
  total_items: number
  corrected_items: number
  accuracy_score: number
  snapshot_type: 'per_job' | 'aggregate'
}
