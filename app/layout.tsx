import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import AuthLayout from '@/components/AuthLayout'

export const metadata: Metadata = {
  title: 'Ryder – AI Body Code Extraction',
  description: 'Ford vehicle spec PDF extraction pipeline',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <AuthProvider>
          <AuthLayout>{children}</AuthLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
