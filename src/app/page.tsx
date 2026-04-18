'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { translations, type Lang } from '@/lib/i18n'
import { calculateDays } from '@/lib/pricing'

type Vehicle = { id: string; name: string; category: string; price_per_day: number; original_price?: number; seats: number; transmission: string; features: string[]; year?: number; image_url?: string; season_name?: string }
type Partner = { id: string; name: string; qr_code: string; client_discount_percent: number }

const ICONS: Record<string, string> = { economy: '🚗', suv: '🚙', premium: '🏎️', minivan: '🚐', convertible: '🚘' }

function HomePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('sr')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [category, setCategory] = useState('all')
  const [pickupDate, setPickupDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [pickupTime, setPickupTime] = useState('10:00')
  const [returnTime, setReturnTime] = useState('10:00')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const tr = translations[lang]

  useEffect(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    setPickupDate(today.toISOString().split('T')[0])
    setReturnDate(nextWeek.toISOString().split('T')[0])

    const qr = searchParams.get('ref') || searchParams.get('qr')
    if (qr) {
      setQrCode(qr)
      fetch(`/api/partners?qr=${qr}`).then(r => r.json()).then(d => { if (d) setPartner(d) }).catch(() => {})
    }

    const bl = navigator.language.slice(0, 2)
    if (bl === 'de') setLang('de')
    else if (bl === 'en') setLang('en')
  }, [searchParams])

  const fetchVehicles = useCallback(() => {
    setLoading(true)
    fetch(`/api/vehicles?category=${category}${pickupDate ? `&pickupDate=${pickupDate}` : ''}${returnDate ? `&returnDate=${returnDate}` : ''}`)
      .then(r => r.json())
      .then(d => { setVehicles(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [category, pickupDate, returnDate, pickupTime, returnTime])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])

  const days = pickupDate && returnDate ? calculateDays(pickupDate, pickupTime, returnDate, returnTime) : null

  function getDiscountedPrice(price: number): number {
    if (!partner?.client_discount_percent) return price
    return Math.round(price * (1 - partner.client_discount_percent / 100) * 100) / 100
  }

  function handleBook(v: Vehicle) {
    const d = days || 7
    const originalPrice = v.price_per_day * d
    const discountedPrice = getDiscountedPrice(originalPrice)
    const params = new URLSearchParams({
      vehicleId: v.id, vehicleName: v.name, pricePerDay: String(v.price_per_day),
      days: String(d), total: String(discountedPrice),
      pickupDate, returnDate, pickupTime, returnTime, lang,
    })
    if (qrCode) params.set('ref', qrCode)
    if (partner) {
      params.set('partnerName', partner.name)
      params.set('partnerDiscount', String(partner.client_discount_percent || 0))
    }
    router.push(`/rezervacija?${params}`)
  }

  const inp = { padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <style>{`
        @media (max-width: 640px) {
          .search-grid { grid-template-columns: 1fr 1fr !important; }
          .search-btn { grid-column: 1 / -1; }
          .vehicles-grid { grid-template-columns: 1fr !important; }
          .category-filters { gap: 6px !important; }
        }
      `}</style>

      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Avto<span style={{ color: '#1D9E75' }}>Rent</span></div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['sr', 'en', 'de'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: lang === l ? '#1D9E75' : '#e5e7eb', background: lang === l ? '#E1F5EE' : 'transparent', color: lang === l ? '#0F6E56' : '#6b7280', cursor: 'pointer', fontWeight: lang === l ? 700 : 400 }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      {partner && (
        <div style={{ background: '#E1F5EE', borderBottom: '1px solid #5DCAA5', padding: '10px 16px', fontSize: 13, color: '#085041' }}>
          🎁 Kao gost apartmana <strong>{partner.name}</strong> ostvarujete <strong>{partner.client_discount_percent}% popusta</strong>!
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 16px', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#111' }}>{tr.heroTitle}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{tr.heroSub}</p>

          <div className="search-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.pickupDate}</label>
              <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Vrijeme preuzimanja</label>
              <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.returnDate}</label>
              <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Vrijeme vraćanja</label>
              <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <button onClick={fetchVehicles} style={{ padding: '11px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                {tr.search}
              </button>
            </div>

          {days && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
              Trajanje: <strong style={{ color: '#111' }}>{days} {days === 1 ? 'dan' : 'dana'}</strong>
            </div>
          )}
        </div>

        <div className="category-filters" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[['all', tr.allCats], ['economy', tr.economy], ['suv', tr.suv], ['premium', tr.premium], ['minivan', tr.minivan]].map(([val, label]) => (
            <button key={val} onClick={() => setCategory(val)} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 20, border: '1px solid', borderColor: category === val ? '#1D9E75' : '#e5e7eb', background: category === val ? '#E1F5EE' : '#fff', color: category === val ? '#0F6E56' : '#6b7280', cursor: 'pointer', fontWeight: category === val ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Učitavanje...</div>
        ) : vehicles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
            <div style={{ fontSize: 14, color: '#374151' }}>Nema dostupnih vozila za odabrani period</div>
          </div>
        ) : (
          <div className="vehicles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {vehicles.map(v => {
              const originalTotal = days ? v.price_per_day * days : null
              const discountedTotal = originalTotal ? getDiscountedPrice(originalTotal) : null
              const hasDiscount = partner && partner.client_discount_percent > 0

              return (
                <div key={v.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ height: 160, background: '#f3f4f6', overflow: 'hidden' }}>
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                        {ICONS[v.category] || '🚗'}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, color: '#111' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {v.category} {v.year && `· ${v.year}`}
                      {v.season_name && <span style={{ marginLeft: 6, background: '#FAEEDA', color: '#854F0B', padding: '1px 6px', borderRadius: 10, textTransform: 'none' }}>{v.season_name}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {[v.transmission === 'automatic' ? tr.automatic : tr.manual, `${v.seats} ${tr.seats}`, ...(v.features || []).slice(0, 1)].map(f => (
                        <span key={f} style={{ fontSize: 11, padding: '3px 8px', background: '#f3f4f6', borderRadius: 20, color: '#6b7280' }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        {hasDiscount ? (
                          <>
                            <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through', marginRight: 4 }}>{v.price_per_day}€</span>
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{getDiscountedPrice(v.price_per_day)}€</span>
                          </>
                        ) : (
                          <>
                            {v.original_price && v.original_price !== v.price_per_day && (
                              <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through', marginRight: 4 }}>{v.original_price}€</span>
                            )}
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{v.price_per_day}€</span>
                          </>
                        )}
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>{tr.perDay}</span>
                        {days && discountedTotal && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            {days} {tr.days} = <strong style={{ color: '#111' }}>{discountedTotal}€</strong>
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleBook(v)} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {tr.book}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {partner && (
          <div style={{ marginTop: 20, background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#085041' }}>
            {tr.qrNote}
          </div>
        )}
      </main>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Učitavanje...</div>}>
      <HomePageContent />
    </Suspense>
  )
}
