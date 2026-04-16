import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_id, corrected_code, corrected_description, corrected_by = 'manual' } = body

    if (!item_id || corrected_code === undefined || corrected_description === undefined) {
      return NextResponse.json(
        { error: 'item_id, corrected_code, and corrected_description are required' },
        { status: 400 }
      )
    }

    // Fetch original item
    const { data: item, error: itemError } = await supabase
      .from('extraction_items')
      .select('*')
      .eq('item_id', item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const correction_id = randomUUID()

    // Insert correction
    const { error: corrError } = await supabase.from('corrections').insert({
      correction_id,
      item_id,
      job_id: item.job_id,
      original_code: item.code,
      original_description: item.description,
      corrected_code,
      corrected_description,
      corrected_by,
    })

    if (corrError) {
      return NextResponse.json({ error: corrError.message }, { status: 500 })
    }

    // Mark item as corrected
    await supabase
      .from('extraction_items')
      .update({ is_corrected: true })
      .eq('item_id', item_id)

    return NextResponse.json({ correction_id, message: 'Correction saved' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
