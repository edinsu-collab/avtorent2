'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ClientLoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Kreiraj ili ažuriraj klijenta
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('email', session.user.email)
          .single()

        if (!existing) {
          await supabase.from('clients').insert({
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            user_id: session.user.id,
          })
        } else {
          await supabase.from('clients').update({ user_id: session.user.id }).eq('email', session.user.email!)
        }

        document.cookie = `avtorent-client-token=${session.access_token}; path=/; max-age=86400`
        document.cookie = `avtorent-client-email=${encodeURIComponent(session.user.email || '')}; path=/; max-age=86400`
        window.location.href = '/moje'
      }
    })
  }, [])

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/moje/login` },
    })
    if (err) { setError('Greška pri Google prijavi.'); setGoogleLoading(false) }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Unesite email i lozinku.'); return }
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError('Pogrešan email ili lozinka.')
      setLoading(false)
      return
    }

    const { data: existing } = await supabase.from('clients').select('id').eq('email', email).single()
    if (!existing) {
      await supabase.from('clients').insert({ email, user_id: data.user.id })
    }

    document.cookie = `avtorent-client-token=${data.session!.access_token}; path=/; max-age=86400`
    document.cookie = `avtorent-client-email=${encodeURIComponent(email)}; path=/; max-age=86400`
    window.location.href = '/moje'
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || !fullName) { setError('Unesite ime, email i lozinku.'); return }
    if (password.length < 6) { setError('Lozinka mora imati najmanje 6 karaktera.'); return }
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signUp({ email, password })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Kreiraj klijenta
    await supabase.from('clients').insert({
      email,
      full_name: fullName,
      phone: phone || null,
      user_id: data.user?.id,
    })

    setSuccess('Nalog je kreiran! Provjerite email za potvrdu, pa se prijavite.')
    setLoading(false)
  }

  const inp = { display: 'block', width: '100%', padding: '10px 12px', marginBottom: 14, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const, color: '#111' }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', padding: 36, borderRadius: 12, width: '100%', maxWidth: 400, border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>
          {mode === 'login' ? 'Prijavite se na vaš nalog' : 'Kreirajte nalog'}
        </div>

        {/* Google */}
        <button onClick={handleGoogleLogin} disabled={googleLoading} style={{ width: '100%', padding: '11px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          {googleLoading ? 'Prijava...' : mode === 'login' ? 'Prijavi se sa Google' : 'Registruj se sa Google'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>ili</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        {success ? (
          <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#085041', textAlign: 'center' }}>
            {success}
          </div>
        ) : (
          <form onSubmit={mode === 'login' ? handleEmailLogin : handleRegister}>
            {mode === 'register' && (
              <>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ime i prezime *</label>
                <input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Marko Petrović" />
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Telefon</label>
                <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+382 67 000 000" />
              </>
            )}
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Email adresa</label>
            <input type="email" style={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="marko@email.com" autoComplete="email" />
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Lozinka</label>
            <input type="password" style={inp} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{error}</div>}

            <button type="submit" disabled={loading} style={{ display: 'block', width: '100%', padding: 11, background: loading ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 14 }}>
              {loading ? '...' : mode === 'login' ? 'Prijavi se' : 'Kreiraj nalog'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
          {mode === 'login' ? (
            <>Nemate nalog? <button onClick={() => { setMode('register'); setError(''); setSuccess('') }} style={{ background: 'none', border: 'none', color: '#1D9E75', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Registrujte se</button></>
          ) : (
            <>Već imate nalog? <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} style={{ background: 'none', border: 'none', color: '#1D9E75', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Prijavite se</button></>
          )}
        </div>
      </div>
    </div>
  )
}
