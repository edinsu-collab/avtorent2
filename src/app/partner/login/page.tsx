'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function PartnerLoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: partner } = await supabase
          .from('partners')
          .select('id, name, qr_code')
          .eq('portal_email', session.user.email)
          .eq('is_active', true)
          .single()

        if (!partner) {
          await supabase.auth.signOut()
          setError('Vaš nalog nije registrovan kao partner. Kontaktirajte administratora.')
          setLoading(false)
          return
        }

        document.cookie = `avtorent-partner-token=${session.access_token}; path=/; max-age=86400`
        document.cookie = `avtorent-partner-id=${partner.id}; path=/; max-age=86400`
        document.cookie = `avtorent-partner-name=${encodeURIComponent(partner.name)}; path=/; max-age=86400`
        window.location.href = '/partner'
      }
    })
  }, [])

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/partner/login` },
    })
    if (err) { setError('Greška pri prijavi.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 12, width: 380, border: '1px solid #e5e7eb', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Partner portal</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 32 }}>Prijavite se da vidite vaše statistike i provizije</div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          {loading ? 'Prijava...' : 'Prijavi se sa Google'}
        </button>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 16 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
