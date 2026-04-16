import UploadDropzone from '@/components/UploadDropzone'

export default function UploadPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload PDF</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a Ford vehicle specification PDF. The pipeline will extract the{' '}
          <strong>"As Configured Vehicle"</strong> section and populate a Ryder Quote Template
          Excel file automatically.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <UploadDropzone />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 space-y-1">
        <p className="font-medium">What happens after upload?</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>The PDF is saved to the input folder</li>
          <li>Claude Vision scans the "As Configured Vehicle" pages</li>
          <li>Codes and descriptions are extracted and stored in Supabase</li>
          <li>A populated Excel file is written to the output folder</li>
          <li>Refresh <a href="/jobs" className="underline">Jobs</a> to see the result</li>
        </ol>
      </div>
    </div>
  )
}
