'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 px-8 py-8">{children}</main>
        <footer className="border-t border-gray-200 bg-white py-4 px-8 text-center text-sm text-gray-400">
          © 2026 Pritchard. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
