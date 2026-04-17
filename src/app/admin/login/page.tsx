'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Provjeri da li je Google SSO vratio sesiju
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Provjeri da li je agent odobren
        const { data: agent } = await supabase
          .from('agents')
          .select('*')
          .eq('email', session.user.email)
          .eq('is_active', true)
          .single()

        if (!agent) {
          await supabase.auth.signOut()
          setError('Vaš nalog nije odobren. Kontaktirajte administratora.')
          setGoogleLoading(false)
          return
        }

        // Sačuvaj token u cookie
        document.cookie = `avtorent-admin-token=${session.access_token}; path=/; max-age=86400`
        // Sačuvaj ime agenta
        document.cookie = `avtorent-agent-name=${encodeURIComponent(agent.full_name || session.user.email)}; path=/; max-age=86400`
        window.location.href = '/admin'
      }
    })
  }, [])

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Unesite email i lozinku.'); return }
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err || !data.session) {
      setError(err?.message || 'Pogrešan email ili lozinka.')
      setLoading(false)
      return
    }

    // Provjeri da li je agent odobren
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (!agent) {
      await supabase.auth.signOut()
      setError('Vaš nalog nije odobren. Kontaktirajte administratora.')
      setLoading(false)
      return
    }

    document.cookie = `avtorent-admin-token=${data.session.access_token}; path=/; max-age=86400`
    document.cookie = `avtorent-agent-name=${encodeURIComponent(agent.full_name || email)}; path=/; max-age=86400`
    window.location.href = '/admin'
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin/login`,
      },
    })
    if (err) {
      setError('Greška pri Google prijavi.')
      setGoogleLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 12, width: 380, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>Admin panel — prijava</div>

        {/* Google SSO dugme */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{ width: '100%', padding: '11px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          {googleLoading ? 'Prijava...' : 'Prijavi se sa Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>ili</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        <form onSubmit={handleEmailLogin}>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Email</label>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '10px 12px', marginBottom: 14, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }}
          />

          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Lozinka</label>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '10px 12px', marginBottom: 18, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }}
          />

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ display: 'block', width: '100%', padding: 11, background: loading ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Prijava...' : 'Prijavi se'}
          </button>
        </form>
      </div>
    </div>
  )
}
