'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { translations, type Lang } from '@/lib/i18n'

const DS = {
  primary: '#1a56a0', primaryDark: '#0e2d5e', primaryLight: '#E6F1FB',
  primaryAccent: '#378ADD', primaryMid: '#185FA5',
  textPrimary: '#111827', textSecondary: '#6b7280', textMuted: '#9ca3af',
  border: '#e5e7eb', borderBlue: '#c5d9f5', bgPage: '#f9fafb', bgCard: '#ffffff',
}

function ConfirmPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (searchParams.get('lang') || 'en') as string
  const refCode = searchParams.get('ref') || ''
  const partnerName = searchParams.get('partnerName') || ''
  const partnerDiscount = parseFloat(searchParams.get('partnerDiscount') || '0')
  const isNewClient = searchParams.get('isNewClient') === 'true'
  const hasLicense = searchParams.get('hasLicense') === 'true'
  const tr = (translations as any)[lang] || translations['en']

  const title = lang === 'de' ? 'Buchung erfolgreich!' : lang === 'en' ? 'Booking confirmed!' : lang === 'tr' ? 'Rezervasyon onaylandı!' : lang === 'ru' ? 'Бронирование подтверждено!' : lang === 'es' ? '¡Reserva confirmada!' : lang === 'fr' ? 'Réservation confirmée !' : lang === 'ar' ? 'تم تأكيد الحجز!' : 'Uspješna rezervacija!'
  const subtitle = lang === 'en' ? 'Your booking confirmation will be sent to your email.' : lang === 'de' ? 'Ihre Buchungsbestätigung wird per E-Mail zugesendet.' : lang === 'ru' ? 'Подтверждение бронирования будет отправлено на ваш email.' : lang === 'tr' ? 'Rezervasyon onayınız e-posta ile gönderilecek.' : 'Potvrdu rezervacije ćete dobiti putem email-a.'
  const refLabel = lang === 'en' ? 'Booking reference' : lang === 'de' ? 'Buchungsnummer' : lang === 'ru' ? 'Номер бронирования' : 'Broj rezervacije'
  const accountLabel = lang === 'en' ? 'My account →' : lang === 'de' ? 'Mein Konto →' : 'Moj nalog →'

  return (
    <div style={{ minHeight: '100vh', background: DS.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <nav style={{ background: DS.bgCard, borderBottom: `1px solid ${DS.border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: DS.textPrimary }}>
            ADRIA<span style={{ color: DS.primaryAccent, fontWeight: 300 }}>DRIVE</span>
          </div>
          <div style={{ fontSize: 9, color: '#4a90d9', letterSpacing: 2 }}>BALKAN · RENT A CAR</div>
        </a>
        <button onClick={() => router.push('/')} style={{ fontSize: 13, color: DS.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← {tr.backHome}
        </button>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
        <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 16, padding: '40px 32px', maxWidth: 480, width: '100%', textAlign: 'center' as const }}>

          <div style={{ width: 64, height: 64, borderRadius: '50%', background: DS.primaryLight, border: `2px solid ${DS.borderBlue}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke={DS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10, color: DS.primaryDark }}>{title}</h1>
          <p style={{ fontSize: 14, color: DS.textSecondary, lineHeight: 1.7, marginBottom: 28 }}>{subtitle}</p>

          {/* Ref code */}
          <div style={{ background: DS.primaryLight, borderRadius: 10, padding: '16px 20px', marginBottom: 20, border: `1px solid ${DS.borderBlue}` }}>
            <div style={{ fontSize: 11, color: DS.primaryMid, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 8 }}>{refLabel}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: DS.primary, letterSpacing: 3 }}>{refCode}</div>
          </div>

          {/* Partner popust */}
          {partnerName && partnerDiscount > 0 && (
            <div style={{ background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16, textAlign: 'left' as const }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DS.primaryDark, marginBottom: 6 }}>
                {lang === 'en' ? `As a guest of ${partnerName}, you got a discount!` : `Kao gost ${partnerName} ostvarili ste popust!`}
              </div>
              <div style={{ fontSize: 13, color: DS.primaryMid }}><strong>{partnerDiscount}%</strong> {lang === 'en' ? 'off your rental.' : 'popusta na najam.'}</div>
            </div>
          )}

          {/* Novi klijent */}
          {isNewClient && (
            <div style={{ background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16, textAlign: 'left' as const }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: DS.primaryDark, marginBottom: 6 }}>
                {lang === 'en' ? 'Check your email' : 'Provjerite email'}
              </div>
              <div style={{ fontSize: 13, color: DS.primaryMid, lineHeight: 1.6 }}>
                {lang === 'en'
                  ? 'We sent you a confirmation and a temporary password. Log in to track your reservations.'
                  : 'Poslali smo vam potvrdu i privremenu lozinku. Prijavite se da pratite rezervacije.'}
              </div>
              <button onClick={() => router.push('/moje/login')} style={{ marginTop: 12, padding: '8px 16px', background: DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {lang === 'en' ? 'Log in →' : 'Prijavi se →'}
              </button>
            </div>
          )}

          {/* Vozačka — samo ako NEMA */}
          {!hasLicense && (
            <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 10, padding: '16px 18px', marginBottom: 16, textAlign: 'left' as const }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                {lang === 'en' ? '📎 Upload your driving licence' : lang === 'de' ? '📎 Führerschein hochladen' : '📎 Uploadujte vozačku dozvolu'}
              </div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6, marginBottom: 10 }}>
                {lang === 'en'
                  ? 'Please log in and upload a photo of your driving licence to confirm your reservation.'
                  : 'Prijavite se na nalog i dodajte sliku vozačke dozvole kako biste potvrdili rezervaciju.'}
              </div>
              <button onClick={() => router.push('/moje')} style={{ padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {lang === 'en' ? 'Go to my account →' : 'Idi na moj nalog →'}
              </button>
            </div>
          )}

          {/* Ima vozačku */}
          {hasLicense && (
            <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'left' as const }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#085041' }}>
                {lang === 'en' ? '✅ Driving licence on file — reservation confirmed!' : '✅ Vozačka dozvola je u dosijeu — rezervacija je potvrđena!'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => router.push('/moje')} style={{ padding: '10px 22px', background: DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {accountLabel}
            </button>
            <button onClick={() => router.push('/')} style={{ padding: '10px 22px', background: 'transparent', border: `1px solid ${DS.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: DS.textSecondary }}>
              {tr.backHome}
            </button>
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${DS.border}`, fontSize: 12, color: DS.textMuted, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
            "Feel the Balkans. Own the road."
          </div>
        </div>
      </div>

      <footer style={{ background: DS.primaryDark, padding: '24px', textAlign: 'center' as const }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>ADRIA<span style={{ fontWeight: 300, color: '#7ab8f5' }}>DRIVE</span></div>
        <div style={{ fontSize: 10, color: '#4a90d9', letterSpacing: 3, marginTop: 4 }}>BALKAN · RENT A CAR</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
          <a href="tel:+38269810805" style={{ fontSize: 12, color: '#7ab8f5', textDecoration: 'none' }}>📞 +382 69 810 805</a>
          <a href="https://wa.me/38269810805" style={{ fontSize: 12, color: '#7ab8f5', textDecoration: 'none' }}>💬 WhatsApp</a>
          <a href="mailto:info@rent-cars.me" style={{ fontSize: 12, color: '#7ab8f5', textDecoration: 'none' }}>✉️ info@rent-cars.me</a>
        </div>
        <div style={{ fontSize: 11, color: '#4a90d9', marginTop: 8 }}>© 2025 AdriaDrive · rent-cars.me</div>
      </footer>
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
