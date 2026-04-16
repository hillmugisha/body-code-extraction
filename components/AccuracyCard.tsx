interface AccuracyCardProps {
  label: string
  score: number
  subLabel?: string
  subScore?: number
  total?: number
  corrected?: number
}

export default function AccuracyCard({
  label,
  score,
  subLabel,
  subScore,
  total,
  corrected,
}: AccuracyCardProps) {
  const colour =
    score >= 90 ? 'text-green-600' : score >= 70 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colour}`}>{score.toFixed(1)}%</p>
      {subLabel && subScore !== undefined && (
        <p className="text-xs text-gray-400 mt-1">
          {subLabel}: {subScore.toFixed(1)}%
        </p>
      )}
      {subLabel && subScore === undefined && (
        <p className="text-xs text-gray-400 mt-1">{subLabel}</p>
      )}
      {total !== undefined && (
        <p className="text-xs text-gray-400 mt-1">
          {total} items · {corrected ?? 0} corrected
        </p>
      )}
    </div>
  )
}
