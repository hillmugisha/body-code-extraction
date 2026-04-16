'use client'

import { useState } from 'react'
import type { ExtractionItem } from '@/lib/supabase'

interface ItemsTableProps {
  items: ExtractionItem[]
  jobId: string
  onCorrectionSaved?: () => void
}

const confidenceStyle: Record<string, string> = {
  high: 'text-green-700 bg-green-50',
  medium: 'text-yellow-700 bg-yellow-50',
  low: 'text-red-700 bg-red-50',
}

export default function ItemsTable({ items, jobId, onCorrectionSaved }: ItemsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const startEdit = (item: ExtractionItem) => {
    setEditingId(item.item_id)
    setEditCode(item.code)
    setEditDesc(item.description)
  }

  const cancelEdit = () => setEditingId(null)

  const submitCorrection = async (item: ExtractionItem) => {
    setSaving(true)
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.item_id,
          corrected_code: editCode,
          corrected_description: editDesc,
        }),
      })
      if (res.ok) {
        setSaved((prev) => new Set(prev).add(item.item_id))
        setEditingId(null)
        onCorrectionSaved?.()
      } else {
        alert('Failed to save correction.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">No items extracted yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left font-medium text-gray-500 w-10">#</th>
            <th className="px-3 py-3 text-left font-medium text-gray-500 w-28">Code</th>
            <th className="px-3 py-3 text-left font-medium text-gray-500">Description</th>
            <th className="px-3 py-3 text-left font-medium text-gray-500 w-24">MSRP</th>
            <th className="px-3 py-3 text-left font-medium text-gray-500 w-20">Conf.</th>
            <th className="px-3 py-3 text-left font-medium text-gray-500 w-32">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {items.map((item) => {
            const isEditing = editingId === item.item_id
            const wasSaved = saved.has(item.item_id)
            const isCorrected = item.is_corrected || wasSaved

            return (
              <tr
                key={item.item_id}
                className={`${isCorrected ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-3 py-2 text-gray-400 tabular-nums">
                  {item.sequence_order + 1}
                </td>
                <td className="px-3 py-2 font-mono">
                  {isEditing ? (
                    <input
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
                    />
                  ) : (
                    item.code
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className={isCorrected ? 'line-through text-gray-400' : ''}>
                      {item.description}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500">{item.msrp ?? '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      confidenceStyle[item.confidence] ?? ''
                    }`}
                  >
                    {item.confidence}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitCorrection(item)}
                        disabled={saving}
                        className="text-xs text-white bg-brand-600 hover:bg-brand-700 px-2 py-1 rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {isCorrected ? 'Re-correct' : 'Correct'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
