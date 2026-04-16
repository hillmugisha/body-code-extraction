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
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3 transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-md hover:border-gray-200 cursor-default">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${colour}`}>{score.toFixed(1)}%</p>
      {subLabel && subScore !== undefined && (
        <p className="text-xs text-gray-400 mt-0.5">
          {subLabel}: {subScore.toFixed(1)}%
        </p>
      )}
      {subLabel && subScore === undefined && (
        <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>
      )}
      {total !== undefined && (
        <p className="text-xs text-gray-400 mt-0.5">
          {total} items · {corrected ?? 0} corrected
        </p>
      )}
    </div>
  )
}
