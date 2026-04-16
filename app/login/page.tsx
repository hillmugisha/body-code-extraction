'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle')
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('loading')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      if (res.ok) {
        const data = await res.json()
        login(data.email)
        const redirect = searchParams.get('redirect') || '/'
        router.replace(redirect)
      } else {
        setStatus('denied')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f0f2f5' }}>
      <div
        className="bg-white w-full max-w-sm"
        style={{
          borderRadius: '20px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
          padding: '44px 40px 40px',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center" style={{ marginBottom: '28px' }}>
          <Image
            src="/pritchard-logo.png"
            alt="Pritchard Commercial"
            width={110}
            height={110}
            className="object-contain"
            priority
          />
        </div>

        {/* Header */}
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px', marginBottom: '6px' }}>
            Ryder Quotes
          </h1>
          <p style={{ fontSize: '13.5px', color: '#94a3b8', fontWeight: 400, lineHeight: 1.5 }}>
            AI-powered body code extraction<br />for quote creation
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '7px' }}
            >
              Pritchard email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setStatus('idle')
              }}
              placeholder="you@pritchards.com"
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '11px 14px',
                fontSize: '14px',
                color: '#111827',
                border: '1.5px solid #d1d5db',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                opacity: status === 'loading' ? 0.5 : 1,
                cursor: status === 'loading' ? 'not-allowed' : 'text',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1F4993'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(31,73,147,0.12)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {status === 'denied' && (
            <div style={{ fontSize: '13px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '9px', padding: '11px 14px', lineHeight: 1.5 }}>
              Access denied. Please email{' '}
              <a href="mailto:hill.mugisha@pritchards.com" style={{ fontWeight: 600, textDecoration: 'underline' }}>
                hill.mugisha@pritchards.com
              </a>{' '}
              to request access.
            </div>
          )}

          {status === 'error' && (
            <div style={{ fontSize: '13px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '9px', padding: '11px 14px' }}>
              Something went wrong. Please try again.
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !email.trim()}
            style={{
              width: '100%',
              padding: '12px',
              marginTop: '4px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: '#1F4993',
              border: 'none',
              borderRadius: '10px',
              cursor: status === 'loading' || !email.trim() ? 'not-allowed' : 'pointer',
              opacity: status === 'loading' || !email.trim() ? 0.55 : 1,
              transition: 'background-color 0.15s, opacity 0.15s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              if (status !== 'loading' && email.trim()) {
                e.currentTarget.style.backgroundColor = '#193a76'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1F4993'
            }}
          >
            {status === 'loading' ? 'Checking access…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
