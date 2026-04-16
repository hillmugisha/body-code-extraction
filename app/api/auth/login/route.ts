import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Look up user — only allow if access_granted is true
  const { data: user, error } = await supabase
    .from('users')
    .select('email, access_granted')
    .eq('email', email)
    .eq('access_granted', true)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'not_found' }, { status: 403 })
  }

  // Atomically increment login_count and update last_login
  await supabase.rpc('increment_login_count', { user_email: email })

  return NextResponse.json({ email: user.email }, { status: 200 })
}
