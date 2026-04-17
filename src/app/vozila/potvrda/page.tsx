'use client'
import { Suspense } from 'react'

import { useSearchParams, useRouter } from 'next/navigation'
import { translations, type Lang } from '@/lib/i18n'

function ConfirmPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (searchParams.get('lang') as Lang) || 'sr'
  const refCode = searchParams.get('ref') || ''
  const partnerName = searchParams.get('partnerName') || ''
  const partnerDiscount = parseFloat(searchParams.get('partnerDiscount') || '0')
  const isNewClient = searchParams.get('isNewClient') === 'true'
  const tr = translations[lang]

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '40px 28px', maxWidth: 480, width: '100%', textAlign: 'center' }}>

        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26, color: '#1D9E75' }}>✓</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#111' }}>{tr.confTitle}</h1>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 24 }}>{tr.confMsg}</p>

        {/* Ref kod */}
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{tr.refLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: '#1D9E75', letterSpacing: 1 }}>{refCode}</div>
        </div>

        {/* Popust partnera */}
        {partnerName && partnerDiscount > 0 && (
          <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🎁</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#085041', marginBottom: 4 }}>
              Kao korisnik <span style={{ color: '#0F6E56' }}>{partnerName}</span> ste ostvarili popust!
            </div>
            <div style={{ fontSize: 13, color: '#0F6E56' }}>Uštedili ste <strong>{partnerDiscount}%</strong> na cijenu najma.</div>
          </div>
        )}

        {/* Info o nalogu */}
        {isNewClient && (
          <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 10, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0C447C', marginBottom: 6 }}>📧 Provjerite email</div>
            <div style={{ fontSize: 13, color: '#185FA5', lineHeight: 1.6 }}>
              Poslali smo vam email sa potvrdom rezervacije i privremenom lozinkom za vaš novi nalog. Prijavite se na <strong>/moje/login</strong> da pratite rezervacije.
            </div>
            <button onClick={() => router.push('/moje/login')} style={{ marginTop: 12, padding: '8px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Prijavi se na nalog →
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {!isNewClient && (
            <button onClick={() => router.push('/moje')} style={{ padding: '9px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Moj nalog →
            </button>
          )}
          <button onClick={() => router.push('/')} style={{ padding: '9px 20px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
            {tr.backHome}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Učitavanje...</div>}>
      <ConfirmPageContent />
    </Suspense>
  )
}
