'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { translations, type Lang } from '@/lib/i18n'
import { calculateDays } from '@/lib/pricing'

type Vehicle = {
  id: string; name: string; category: string; vehicle_class?: string; price_per_day: number
  original_price?: number; seats: number; transmission: string
  features: string[]; year?: number; image_url?: string; season_name?: string
  vehicle_locations?: { location_id: string; locations?: { name: string; city: string } }[]
}
type Partner = { id: string; name: string; qr_code: string; client_discount_percent: number; location_id?: string; location_name?: string }
type Location = { id: string; name: string; city: string; country: string }
type Transfer = { id: string; from_location_id: string; to_location_id: string; price: number }
type SiteConfig = {
  id: string; domain: string; name: string; tagline: string
  primary_color: string; secondary_color: string; logo_text: string
  price_modifier: number
}

const ICONS: Record<string, string> = {
  Hatchback: '🚗', Medium: '🚗', Sedan: '🚗', SUV: '🚙',
  'Station Wagon': '🚗', Luxury: '🏎️', Van: '🚐', Convertible: '🚘',
  mini: '🚗', economy: '🚗', compact: '🚗', suv: '🚙', premium: '🏎️',
}

// Kategorije iz vehicle_class kolone u vozila_fleet
const VEHICLE_CLASSES = [
  'all',
  'Hatchback',
  'Medium',
  'Sedan',
  'SUV',
  'Station Wagon',
  'Luxury',
  'Van',
  'Convertible',
]

const CLASS_LABELS: Record<string, string> = {
  all: 'Sva vozila',
  Hatchback: 'Hatchback',
  Medium: 'Medium',
  Sedan: 'Sedan',
  SUV: 'SUV',
  'Station Wagon': 'Karavan',
  Luxury: 'Luksuz',
  Van: 'Kombi',
  Convertible: 'Kabriolet',
}

function HomePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('sr')
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [category, setCategory] = useState('all')
  const [pickupDate, setPickupDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [pickupTime, setPickupTime] = useState('10:00')
  const [returnTime, setReturnTime] = useState('10:00')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [pickupLocationId, setPickupLocationId] = useState('')
  const [pickupCustom, setPickupCustom] = useState('')
  const [differentDropoff, setDifferentDropoff] = useState(false)
  const [dropoffLocationId, setDropoffLocationId] = useState('')
  const [dropoffCustom, setDropoffCustom] = useState('')
  const [site, setSite] = useState<SiteConfig | null>(null)
  const tr = translations[lang]

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://app.trysoro.com/api/embed/16773211-0733-4454-87cc-ebd145c43c1b'
    script.defer = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  useEffect(() => {
    const siteParam = searchParams.get('site')
    const domain = siteParam || (typeof window !== 'undefined' ? window.location.hostname : 'rent-cars.me')
    fetch(`/api/site?domain=${domain}`)
      .then(r => r.json())
      .then(d => { if (d) setSite(d) })
      .catch(() => {})
  }, [searchParams])

  useEffect(() => {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    setPickupDate(today.toISOString().split('T')[0])
    setReturnDate(nextWeek.toISOString().split('T')[0])

    fetch('/api/locations').then(r => r.json()).then(d => {
      setLocations(d.locations || [])
      setTransfers(d.transfers || [])
    })

    const qr = searchParams.get('ref') || searchParams.get('qr')
    if (qr) {
      setQrCode(qr)
      fetch(`/api/partners?qr=${qr}`).then(r => r.json()).then(d => {
        if (d) {
          setPartner(d)
          if (d.location_id) setPickupLocationId(d.location_id)
          else if (d.location_name) setPickupCustom(d.location_name)
        }
      }).catch(() => {})
    }

    const bl = navigator.language.slice(0, 2)
    if (bl === 'de') setLang('de')
    else if (bl === 'en') setLang('en')
  }, [searchParams])

  const fetchVehicles = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (pickupDate) params.set('pickupDate', pickupDate)
    if (returnDate) params.set('returnDate', returnDate)
    if (pickupLocationId && pickupLocationId !== 'custom') params.set('locationId', pickupLocationId)
    fetch(`/api/vehicles?${params}`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : []
        setAllVehicles(arr)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [pickupDate, returnDate, pickupLocationId])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])

  // Filtriraj po vehicle_class na klijentskoj strani
  useEffect(() => {
    if (category === 'all') {
      setVehicles(allVehicles)
    } else {
      setVehicles(allVehicles.filter(v =>
        (v.vehicle_class || '').toLowerCase() === category.toLowerCase() ||
        (v.category || '').toLowerCase() === category.toLowerCase()
      ))
    }
  }, [category, allVehicles])

  // Dostupne klase iz učitanih vozila
  const availableClasses = ['all', ...Array.from(new Set(
    allVehicles.map(v => v.vehicle_class || v.category).filter(Boolean)
  )).sort()]

  const days = pickupDate && returnDate ? calculateDays(pickupDate, pickupTime, returnDate, returnTime) : null
  const primaryColor = site?.primary_color || '#1a56a0'
  const siteName = site?.logo_text || 'AdriaDrive'
  const priceModifier = site?.price_modifier || 1.00
  const isCorporate = priceModifier < 1

  function getTransferFee(): number {
    if (!differentDropoff) return 0
    if (!pickupLocationId || pickupLocationId === 'custom') return 0
    if (!dropoffLocationId || dropoffLocationId === 'custom') return 0
    if (pickupLocationId === dropoffLocationId) return 0
    const transfer = transfers.find(t => t.from_location_id === pickupLocationId && t.to_location_id === dropoffLocationId)
    return transfer?.price || 0
  }

  function getDisplayPrice(basePrice: number): number {
    const withModifier = Math.round(basePrice * priceModifier)
    if (!partner?.client_discount_percent) return withModifier
    return Math.round(withModifier * (1 - partner.client_discount_percent / 100))
  }

  function getPickupLocationName(): string {
    if (pickupLocationId === 'custom') return pickupCustom
    return locations.find(l => l.id === pickupLocationId)?.name || ''
  }

  function getDropoffLocationName(): string {
    if (!differentDropoff) return getPickupLocationName()
    if (dropoffLocationId === 'custom') return dropoffCustom
    return locations.find(l => l.id === dropoffLocationId)?.name || ''
  }

  function handleBook(v: Vehicle) {
    const d = days || 7
    const transferFee = getTransferFee()
    const displayPrice = getDisplayPrice(v.price_per_day)
    const total = displayPrice * d + transferFee
    const params = new URLSearchParams({
      vehicleId: v.id, vehicleName: v.name,
      vehicleCategory: v.vehicle_class || v.category || '',
      vehicleSeats: String(v.seats || ''),
      vehicleTransmission: v.transmission || '',
      vehicleYear: String(v.year || ''),
      vehicleImage: v.image_url || '',
      pricePerDay: String(displayPrice),
      days: String(d), total: String(total),
      pickupDate, returnDate, pickupTime, returnTime, lang,
      pickupLocation: getPickupLocationName(),
      dropoffLocation: getDropoffLocationName(),
      transferFee: String(transferFee),
      siteDomain: site?.domain || '',
    })
    if (pickupLocationId && pickupLocationId !== 'custom') params.set('pickupLocationId', pickupLocationId)
    if (differentDropoff && dropoffLocationId && dropoffLocationId !== 'custom') params.set('dropoffLocationId', dropoffLocationId)
    if (qrCode) params.set('ref', qrCode)
    if (partner) {
      params.set('partnerName', partner.name)
      params.set('partnerDiscount', String(partner.client_discount_percent || 0))
    }
    router.push(`/rezervacija?${params}`)
  }

  const inp = { padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', width: '100%', boxSizing: 'border-box' as const }
  const transferFee = getTransferFee()

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
          <span style={{ color: primaryColor }}>{siteName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/o-nama" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
            {lang === 'sr' ? 'O nama' : lang === 'de' ? 'Über uns' : 'About'}
          </a>
          <a href="/faq" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>FAQ</a>
          <a href="/kontakt" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
            {lang === 'sr' ? 'Kontakt' : lang === 'de' ? 'Kontakt' : 'Contact'}
          </a>
          <a href="/blog" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>Blog</a>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['sr', 'en', 'de'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: lang === l ? primaryColor : '#e5e7eb', background: lang === l ? `${primaryColor}22` : 'transparent', color: lang === l ? primaryColor : '#6b7280', cursor: 'pointer', fontWeight: lang === l ? 700 : 400 }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      {isCorporate && (
        <div style={{ background: site?.primary_color || '#1a1a2e', padding: '10px 16px', fontSize: 13, color: '#fff', textAlign: 'center', fontWeight: 500 }}>
          Dobrodošli na {site?.name} — direktne cijene bez posrednika
        </div>
      )}

      {partner && (
        <div style={{ background: '#E1F5EE', borderBottom: '1px solid #5DCAA5', padding: '10px 16px', fontSize: 13, color: '#085041' }}>
          {'Kao gost '}<strong>{partner.name}</strong>{' ostvarujete '}<strong>{partner.client_discount_percent}% popusta</strong>{'!'}
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 16px', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#111' }}>{site?.tagline || tr.heroTitle}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{tr.heroSub}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.pickupLoc}</label>
              <select value={pickupLocationId} onChange={e => setPickupLocationId(e.target.value)} style={inp}>
                <option value="">-- Odaberi lokaciju --</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.country})</option>)}
                <option value="custom">Druga adresa</option>
              </select>
              {pickupLocationId === 'custom' && (
                <input value={pickupCustom} onChange={e => setPickupCustom(e.target.value)} placeholder="Unesite adresu preuzimanja..." style={{ ...inp, marginTop: 6 }} />
              )}
            </div>

            {!differentDropoff ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <button onClick={() => setDifferentDropoff(true)} style={{ fontSize: 12, color: primaryColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  + {tr.returnDiffLocation}
                </button>
              </div>
            ) : (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label style={{ fontSize: 11, color: '#6b7280' }}>Lokacija vraćanja</label>
                  <button onClick={() => { setDifferentDropoff(false); setDropoffLocationId(''); setDropoffCustom('') }} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Ukloni</button>
                </div>
                <select value={dropoffLocationId} onChange={e => setDropoffLocationId(e.target.value)} style={inp}>
                  <option value="">-- Odaberi lokaciju --</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.country})</option>)}
                  <option value="custom">Druga adresa</option>
                </select>
                {dropoffLocationId === 'custom' && (
                  <>
                    <input value={dropoffCustom} onChange={e => setDropoffCustom(e.target.value)} placeholder="Unesite adresu vraćanja..." style={{ ...inp, marginTop: 6 }} />
                    <div style={{ fontSize: 11, color: '#BA7517', marginTop: 4, padding: '6px 10px', background: '#FAEEDA', borderRadius: 6 }}>
                      Dostava na custom adresi može biti podložna dodatnoj naplati.
                    </div>
                  </>
                )}
                {transferFee > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#085041', background: '#E1F5EE', padding: '6px 10px', borderRadius: 6 }}>
                    Naknada za transfer: <strong>{transferFee}€</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.pickupDate}</label>
              <input type="date" value={pickupDate} min={new Date().toISOString().split('T')[0]} onChange={e => setPickupDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.pickupTime}</label>
              <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.returnDate}</label>
              <input type="date" value={returnDate} min={pickupDate || new Date().toISOString().split('T')[0]} onChange={e => setReturnDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.returnTime}</label>
              <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button onClick={fetchVehicles} style={{ width: '100%', padding: '11px', background: primaryColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {tr.search}
              </button>
            </div>
          </div>

          {days && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
              {tr.duration}: <strong style={{ color: '#111' }}>{days} {days === 1 ? 'dan' : 'dana'}</strong>
              {transferFee > 0 && <span style={{ marginLeft: 12, color: '#BA7517' }}>+ {transferFee}€ transfer</span>}
            </div>
          )}
        </div>

        {/* Kategorije — dinamički iz baze */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {availableClasses.map(cls => (
            <button key={cls} onClick={() => setCategory(cls)}
              style={{ padding: '6px 14px', fontSize: 13, borderRadius: 20, border: '1px solid', borderColor: category === cls ? primaryColor : '#e5e7eb', background: category === cls ? `${primaryColor}22` : '#fff', color: category === cls ? primaryColor : '#6b7280', cursor: 'pointer', fontWeight: category === cls ? 600 : 400 }}>
              {cls === 'all' ? (tr.allCats || 'Sva vozila') : cls}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Učitavanje...</div>
        ) : vehicles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
            <div style={{ fontSize: 14, color: '#374151' }}>Nema dostupnih vozila za odabrani period i lokaciju</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {vehicles.map(v => {
              const displayPrice = getDisplayPrice(v.price_per_day)
              const originalTotal = days ? displayPrice * days : null
              const totalWithTransfer = originalTotal ? originalTotal + transferFee : null
              const hasPartnerDiscount = partner && partner.client_discount_percent > 0
              const cls = v.vehicle_class || v.category || ''

              return (
                <div key={v.id} style={{ background: '#fff', border: '1px solid #c5d9f5', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,86,160,0.06)' }}>
                  <div style={{ height: 160, background: '#f3f4f6', overflow: 'hidden' }}>
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                        {ICONS[cls] || '🚗'}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, color: '#111' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                      {cls}{v.year && ` · ${v.year}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {[v.transmission === 'automatic' ? tr.automatic : tr.manual, `${v.seats} ${tr.seats}`, ...(v.features || []).slice(0, 1)].filter(Boolean).map(f => (
                        <span key={f} style={{ fontSize: 11, padding: '3px 8px', background: '#f3f4f6', borderRadius: 20, color: '#6b7280' }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        {(isCorporate || hasPartnerDiscount) && (
                          <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through', marginRight: 4 }}>{v.price_per_day}€</span>
                        )}
                        <span style={{ fontSize: 20, fontWeight: 700, color: primaryColor }}>{displayPrice}€</span>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>{tr.perDay}</span>
                        {days && totalWithTransfer && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            {days} {tr.days} = <strong style={{ color: '#111' }}>{totalWithTransfer}€</strong>
                            {transferFee > 0 && <span style={{ fontSize: 10, color: '#BA7517' }}> (+{transferFee}€)</span>}
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleBook(v)} style={{ padding: '8px 16px', background: primaryColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {tr.book}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 40, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>
                {lang === 'sr' ? 'Sa našeg bloga' : lang === 'en' ? 'From our blog' : 'Aus unserem Blog'}
              </h2>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                {lang === 'sr' ? 'Savjeti, destinacije i vijesti' : lang === 'en' ? 'Tips, destinations and news' : 'Tipps, Reiseziele und Neuigkeiten'}
              </p>
            </div>
            <a href="/blog" style={{ fontSize: 13, color: primaryColor, textDecoration: 'none', fontWeight: 600 }}>
              {lang === 'sr' ? 'Svi članci →' : lang === 'en' ? 'All articles →' : 'Alle Artikel →'}
            </a>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 40, marginBottom: 24 }}>
          {[
            { icon: '🛡️', title: lang === 'sr' ? 'Bez skrivenih troškova' : lang === 'en' ? 'No hidden fees' : 'Keine versteckten Kosten', desc: lang === 'sr' ? 'Cijena je konačna. Bez iznenađenja.' : lang === 'en' ? 'Final price. No surprises.' : 'Endpreis. Keine Überraschungen.' },
            { icon: '📍', title: lang === 'sr' ? 'Dostava na vašu adresu' : lang === 'en' ? 'Delivery to your address' : 'Lieferung zu Ihrer Adresse', desc: lang === 'sr' ? 'Aerodrom, hotel, apartman.' : lang === 'en' ? 'Airport, hotel, apartment.' : 'Flughafen, Hotel, Apartment.' },
            { icon: '💬', title: lang === 'sr' ? 'Podrška 24/7' : lang === 'en' ? '24/7 support' : '24/7 Support', desc: lang === 'sr' ? 'Uvijek dostupni za vas.' : lang === 'en' ? 'Always available for you.' : 'Immer für Sie erreichbar.' },
            { icon: '⭐', title: lang === 'sr' ? 'Provjereni na Balkanu' : lang === 'en' ? 'Trusted in the Balkans' : 'Vertrauenswürdig auf dem Balkan', desc: lang === 'sr' ? 'Iskustvo iz prve ruke.' : lang === 'en' ? 'First-hand experience.' : 'Aus erster Hand.' },
          ].map(item => (
            <div key={item.title} style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid #c5d9f5', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0e2d5e', marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <div style={{ background: '#f3f7fd', borderTop: '1px solid #e5e7eb', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>
              {lang === 'sr' ? 'Blog & Savjeti' : lang === 'en' ? 'Blog & Tips' : 'Blog & Tipps'}
            </h2>
            <a href="/blog" style={{ fontSize: 13, color: primaryColor, textDecoration: 'none', fontWeight: 600 }}>
              {lang === 'sr' ? 'Svi članci →' : lang === 'en' ? 'All articles →' : 'Alle Artikel →'}
            </a>
          </div>
          <div id="soro-blog" />
        </div>
      </div>

      <footer style={{ background: '#0e2d5e', padding: '32px 24px', marginTop: 40 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>ADRIA<span style={{ fontWeight: 300, color: '#4a90d9' }}>DRIVE</span></div>
            <div style={{ fontSize: 10, color: '#4a90d9', letterSpacing: 3 }}>BALKAN · RENT A CAR</div>
            <div style={{ fontSize: 12, color: '#7ab8f5', marginTop: 8, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>"Feel the Balkans. Own the road."</div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="mailto:info@rent-cars.me" style={{ fontSize: 13, color: '#7ab8f5', textDecoration: 'none' }}>info@rent-cars.me</a>
            <a href="https://wa.me/38269000000" style={{ fontSize: 13, color: '#7ab8f5', textDecoration: 'none' }}>WhatsApp</a>
          </div>
          <div style={{ fontSize: 12, color: '#4a90d9' }}>© 2025 AdriaDrive · rent-cars.me</div>
        </div>
      </footer>
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
