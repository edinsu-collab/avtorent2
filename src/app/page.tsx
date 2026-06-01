'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { translations, type Lang } from '@/lib/i18n'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
// Lang is now: 'sr' | 'en' | 'de' | 'tr' | 'es' | 'fr' | 'ar' | 'ru'
import { calculateDays } from '@/lib/pricing'

type Vehicle = {
  id: string; name: string; category: string; price_per_day: number
  original_price?: number; seats: number; transmission: string
  fuel_type?: string; features: string[]; year?: number; image_url?: string
  season_name?: string; category_name?: string; slobodnih?: number; lokacija?: string
  vehicle_locations?: { location_id: string; locations?: { name: string; city: string } }[]
}
type Partner = { id: string; name: string; qr_code: string; client_discount_percent: number; location_id?: string; location_name?: string }
type Location = { id: string; name: string; city: string; country: string }
type Transfer = { id: string; from_location_id: string; to_location_id: string; price: number }


function HomePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('en')  // default english for international audience
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [category, setCategory] = useState('all')
  const [transmission, setTransmission] = useState('all')
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
  const [dateError, setDateError] = useState('')
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string } | null>(null)
  const [loggedInName, setLoggedInName] = useState<string | null>(null)
  const tr = translations[lang]

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://app.trysoro.com/api/embed/16773211-0733-4454-87cc-ebd145c43c1b'
    script.defer = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  // Site config not needed — AdriaDrive is fixed branding for rent-cars.me
  // useEffect removed to prevent re-render flicker

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

    // Check if client is logged in
    const _clientEmail = getCookie('avtorent-client-email')
    if (_clientEmail) {
      supabaseClient.from('clients').select('first_name, full_name, email').eq('email', _clientEmail).single()
        .then(({ data }) => {
          if (data) setLoggedInName(data.first_name || data.full_name?.split(' ')[0] || data.email?.split('@')[0] || null)
        })
    }

    const bl = navigator.language.slice(0, 2)
    const langMap: Record<string, Lang> = {
      'de': 'de', 'en': 'en', 'tr': 'tr', 'es': 'es',
      'fr': 'fr', 'ar': 'ar', 'ru': 'ru',
    }
    if (langMap[bl]) setLang(langMap[bl])
    else setLang('en')

    // Provjeri je li klijent ulogovan
  function getCookie(name: string): string {
      if (typeof document === 'undefined') return ''
      const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
      return match ? decodeURIComponent(match[1]) : ''
    }
    const _clientEmail2 = getCookie('avtorent-client-email')
    if (_clientEmail2) {
      supabaseClient.from('clients').select('full_name, first_name, last_name, email').eq('email', _clientEmail2).single()
        .then(({ data: c }) => {
          if (c) setLoggedInUser({
            email: c.email,
            name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || c.email,
          })
        })
    }
  }, [searchParams])

  // Auto-fix return date if pickup moves later
  function handlePickupDateChange(val: string) {
    setPickupDate(val)
    setDateError('')
    if (returnDate && val > returnDate) {
      // Auto-advance return date by same offset
      const diff = new Date(returnDate).getTime() - new Date(pickupDate).getTime()
      const newReturn = new Date(new Date(val).getTime() + Math.max(diff, 86400000))
      setReturnDate(newReturn.toISOString().split('T')[0])
    }
  }

  function handleReturnDateChange(val: string) {
    if (pickupDate && val < pickupDate) {
      setDateError(lang === 'en' ? 'Return date must be after pickup date' : lang === 'de' ? 'Rückgabedatum muss nach dem Abholdatum liegen' : 'Datum povratka mora biti poslije datuma preuzimanja')
      return
    }
    setDateError('')
    setReturnDate(val)
  }

  const fetchVehicles = useCallback(() => {
    // Validate dates before search
    if (pickupDate && returnDate && returnDate < pickupDate) {
      setDateError(lang === 'en' ? 'Return date must be after pickup date' : 'Datum povratka mora biti poslije datuma preuzimanja')
      return
    }
    setDateError('')
    setLoading(true)
    const params = new URLSearchParams({ category })
    if (pickupDate) params.set('pickupDate', pickupDate)
    if (returnDate) params.set('returnDate', returnDate)
    if (pickupLocationId && pickupLocationId !== 'custom') params.set('locationId', pickupLocationId)
    if (pickupLocation) params.set('pickupLocation', pickupLocation)
    fetch(`/api/vehicles?${params}`)
      .then(r => r.json())
      .then(d => { setVehicles(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [category, pickupDate, returnDate, pickupLocationId, lang])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])

  const days = pickupDate && returnDate ? calculateDays(pickupDate, pickupTime, returnDate, returnTime) : null
  const primaryColor = '#1a56a0'
  const siteName = 'AdriaDrive'
  const priceModifier = 1.00
  const isCorporate = false  // not used for rent-cars.me

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
      vehicleCategory: v.category || '',
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
      siteDomain: 'rent-cars.me',
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

  const inp: React.CSSProperties = { padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', width: '100%', boxSizing: 'border-box' }
  const transferFee = getTransferFee()

  // Filter vehicles by transmission
  const filteredVehicles = transmission === 'all'
    ? vehicles
    : vehicles.filter(v => {
        const t = (v.transmission || '').toLowerCase()
        if (transmission === 'automatic') return t.includes('auto')
        if (transmission === 'manual') return t.includes('manual') || t.includes('manuel')
        return true
      })

  // Categories — no icons (consistent)
  const CATEGORIES: [string, string][] = [
    ['all', lang === 'sr' ? 'Sve' : lang === 'de' ? 'Alle' : lang === 'ru' ? 'Все' : lang === 'tr' ? 'Tümü' : lang === 'fr' ? 'Tous' : lang === 'es' ? 'Todos' : lang === 'ar' ? 'الكل' : 'All'],
    ['Hatchback', 'Hatchback'],
    ['Medium', 'Medium'],
    ['Sedan', 'Sedan'],
    ['SUV', 'SUV'],
    ['Station Wagon', lang === 'de' ? 'Kombi' : lang === 'sr' ? 'Karavan' : 'Wagon'],
    ['Luxury', lang === 'de' ? 'Luxus' : 'Luxury'],
    ['Van', 'Van'],
    ['Convertible', lang === 'de' ? 'Cabrio' : lang === 'sr' ? 'Kabriolet' : 'Convertible'],
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, height: 56 }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#0e2d5e', letterSpacing: -0.5 }}>ADRIA</span>
          <span style={{ fontSize: 18, fontWeight: 300, color: '#378ADD', letterSpacing: 1 }}>DRIVE</span>
        </a>

        {/* Nav links — desktop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/o-nama" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
            {lang === 'sr' ? 'O nama' : lang === 'de' ? 'Über uns' : lang === 'fr' ? 'À propos' : lang === 'ru' ? 'О нас' : 'About'}
          </a>
          <a href="/faq" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>FAQ</a>
          <a href="/kontakt" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
            {lang === 'sr' ? 'Kontakt' : lang === 'de' ? 'Kontakt' : lang === 'ru' ? 'Контакт' : 'Contact'}
          </a>
        </div>

        {/* Right side: lang dropdown + account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Language dropdown */}
          <div style={{ position: 'relative' as const }}>
            <select
              value={lang}
              onChange={e => setLang(e.target.value as Lang)}
              style={{ padding: '5px 28px 5px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 20, background: '#f9fafb', color: '#374151', cursor: 'pointer', appearance: 'none' as const, WebkitAppearance: 'none' as const }}
            >
              <option value="en">🌐 EN</option>
              <option value="sr">🇲🇪 SR</option>
              <option value="de">🇩🇪 DE</option>
              <option value="ru">🇷🇺 RU</option>
              <option value="tr">🇹🇷 TR</option>
              <option value="es">🇪🇸 ES</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="ar">🇸🇦 AR</option>
            </select>
            <span style={{ position: 'absolute' as const, right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#9ca3af', pointerEvents: 'none' as const }}>▾</span>
          </div>

          {/* Account */}
          {loggedInName
            ? <a href="/moje" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', background: '#E6F1FB', borderRadius: 20, padding: '5px 14px 5px 6px', border: '1px solid #c5d9f5' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a56a0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  {loggedInName[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 12, color: '#185FA5', fontWeight: 600 }}>{loggedInName}</span>
              </a>
            : <a href="/moje/login" style={{ fontSize: 13, color: '#1a56a0', textDecoration: 'none', fontWeight: 600, padding: '6px 14px', border: '1px solid #c5d9f5', borderRadius: 20, background: '#f0f6ff' }}>
                {lang === 'de' ? 'Anmelden' : lang === 'ru' ? 'Войти' : lang === 'tr' ? 'Giriş' : lang === 'ar' ? 'دخول' : 'Log in'}
              </a>
          }
        </div>
      </nav>



      {partner && (
        <div style={{ background: '#E1F5EE', borderBottom: '1px solid #5DCAA5', padding: '10px 16px', fontSize: 13, color: '#085041' }}>
          Kao gost <strong>{partner.name}</strong> ostvarujete <strong>{partner.client_discount_percent}% popusta</strong>!
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 16px', marginBottom: 16 }}>
          {/* Heading */}
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#111' }}>
            Rent a car in Montenegro, Albania, BiH, Serbia
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            {lang === 'en' ? 'Drop off anywhere in Europe.' : lang === 'de' ? 'Rückgabe überall in Europa.' : 'Povrat vozila bilo gdje u Evropi.'}
          </p>

          {/* Lokacije */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.pickupLoc}</label>
              <select value={pickupLocationId} onChange={e => setPickupLocationId(e.target.value)} style={inp}>
                <option value="">{lang === 'sr' ? '-- Odaberi lokaciju --' : lang === 'de' ? '-- Standort wählen --' : lang === 'ru' ? '-- Выберите локацию --' : lang === 'tr' ? '-- Konum seçin --' : lang === 'fr' ? '-- Choisir un lieu --' : lang === 'es' ? '-- Elegir ubicación --' : lang === 'ar' ? '-- اختر الموقع --' : '-- Select location --'}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({lang === 'sr' ? l.country : l.country === 'Crna Gora' ? 'Montenegro' : l.country === 'Srbija' ? 'Serbia' : l.country === 'Bosna i Hercegovina' ? 'Bosnia & Herzegovina' : l.country === 'Albanija' ? 'Albania' : l.country === 'Hrvatska' ? 'Croatia' : l.country})</option>)}
                <option value="custom">{lang === 'sr' ? 'Druga adresa' : lang === 'de' ? 'Andere Adresse' : lang === 'ru' ? 'Другой адрес' : lang === 'tr' ? 'Başka adres' : lang === 'fr' ? 'Autre adresse' : lang === 'es' ? 'Otra dirección' : lang === 'ar' ? 'عنوان آخر' : 'Other address'}</option>
              </select>
              {pickupLocationId === 'custom' && (
                <input value={pickupCustom} onChange={e => setPickupCustom(e.target.value)} placeholder={lang === 'sr' ? 'Unesite adresu preuzimanja...' : lang === 'de' ? 'Abholadresse eingeben...' : lang === 'ru' ? 'Введите адрес получения...' : lang === 'tr' ? 'Teslim adresini girin...' : lang === 'fr' ? 'Adresse de prise en charge...' : lang === 'es' ? 'Dirección de recogida...' : lang === 'ar' ? 'أدخل عنوان الاستلام...' : 'Enter pickup address...'} style={{ ...inp, marginTop: 6 }} />
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
                  <option value="">{lang === 'sr' ? '-- Odaberi lokaciju --' : lang === 'de' ? '-- Standort wählen --' : lang === 'ru' ? '-- Выберите локацию --' : lang === 'tr' ? '-- Konum seçin --' : lang === 'fr' ? '-- Choisir un lieu --' : lang === 'es' ? '-- Elegir ubicación --' : lang === 'ar' ? '-- اختر الموقع --' : '-- Select location --'}</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({lang === 'sr' ? l.country : l.country === 'Crna Gora' ? 'Montenegro' : l.country === 'Srbija' ? 'Serbia' : l.country === 'Bosna i Hercegovina' ? 'Bosnia & Herzegovina' : l.country === 'Albanija' ? 'Albania' : l.country === 'Hrvatska' ? 'Croatia' : l.country})</option>)}
                  <option value="custom">{lang === 'sr' ? 'Druga adresa' : lang === 'de' ? 'Andere Adresse' : lang === 'ru' ? 'Другой адрес' : lang === 'tr' ? 'Başka adres' : lang === 'fr' ? 'Autre adresse' : lang === 'es' ? 'Otra dirección' : lang === 'ar' ? 'عنوان آخر' : 'Other address'}</option>
                </select>
                {dropoffLocationId === 'custom' && (
                  <>
                    <input value={dropoffCustom} onChange={e => setDropoffCustom(e.target.value)} placeholder={lang === 'sr' ? 'Unesite adresu vraćanja...' : lang === 'de' ? 'Rückgabeadresse eingeben...' : lang === 'ru' ? 'Введите адрес возврата...' : lang === 'tr' ? 'İade adresini girin...' : lang === 'fr' ? 'Adresse de retour...' : lang === 'es' ? 'Dirección de devolución...' : lang === 'ar' ? 'أدخل عنوان الإرجاع...' : 'Enter return address...'} style={{ ...inp, marginTop: 6 }} />
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

          {/* Datumi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.pickupDate}</label>
              <input type="date" value={pickupDate} min={new Date().toISOString().split('T')[0]}
                onChange={e => handlePickupDateChange(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.pickupTime}</label>
              <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.returnDate}</label>
              <input type="date" value={returnDate} min={pickupDate || new Date().toISOString().split('T')[0]}
                onChange={e => handleReturnDateChange(e.target.value)}
                style={{ ...inp, borderColor: dateError ? '#ef4444' : '#d1d5db' }} />
              {dateError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{dateError}</div>}
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{tr.returnTime}</label>
              <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button onClick={fetchVehicles} disabled={!!dateError}
                style={{ width: '100%', padding: '11px', background: dateError ? '#9ca3af' : '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: dateError ? 'not-allowed' : 'pointer' }}>
                {tr.search}
              </button>
            </div>
          </div>

          {days && !dateError && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
              {tr.duration}: <strong style={{ color: '#111' }}>{days} {lang === 'en' ? (days === 1 ? 'day' : 'days') : lang === 'de' ? (days === 1 ? 'Tag' : 'Tage') : lang === 'ru' ? 'дн.' : (days === 1 ? 'dan' : 'dana')}</strong>
              {transferFee > 0 && <span style={{ marginLeft: 12, color: '#BA7517' }}>+ {transferFee}€ transfer</span>}
            </div>
          )}
        </div>

        {/* Filteri — Klase (bez ikona) + Transmission */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' as const }}>
          {CATEGORIES.map(([val, label]) => (
            <button key={val} onClick={() => setCategory(val)}
              style={{ padding: '6px 14px', fontSize: 13, borderRadius: 20, border: '1px solid', borderColor: category === val ? primaryColor : '#e5e7eb', background: category === val ? `${primaryColor}22` : '#fff', color: category === val ? primaryColor : '#6b7280', cursor: 'pointer', fontWeight: category === val ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {/* Transmission filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
            {lang === 'en' ? 'Transmission:' : lang === 'de' ? 'Getriebe:' : 'Mjenjač:'}
          </span>
          {[['all', lang === 'en' ? 'All' : lang === 'de' ? 'Alle' : 'Sve'], ['manual', lang === 'en' ? 'Manual' : lang === 'de' ? 'Schaltung' : 'Manual'], ['automatic', lang === 'en' ? 'Automatic' : lang === 'de' ? 'Automatik' : 'Automatik']].map(([val, label]) => (
            <button key={val} onClick={() => setTransmission(val)}
              style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, border: '1px solid', borderColor: transmission === val ? '#374151' : '#e5e7eb', background: transmission === val ? '#374151' : '#fff', color: transmission === val ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: transmission === val ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Učitavanje...</div>
        ) : filteredVehicles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
            <div style={{ fontSize: 14, color: '#374151' }}>Nema dostupnih vozila za odabrani period i lokaciju</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filteredVehicles.map(v => {
              const displayPrice = getDisplayPrice(v.price_per_day)
              const originalPrice = v.price_per_day
              const hasPartnerDiscount = partner && partner.client_discount_percent > 0
              const originalTotal = days ? displayPrice * days : null
              const totalWithTransfer = originalTotal ? originalTotal + transferFee : null

              return (
                <div key={v.id} style={{ background: '#fff', border: '1px solid #c5d9f5', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,86,160,0.06)' }}>
                  <div style={{ height: 160, background: '#f3f4f6', overflow: 'hidden' }}>
                    {v.image_url ? (
                      <img src={v.image_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, color: '#d1d5db' }}>🚗</div>
                    )}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, color: '#111' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                      {v.category}{v.year ? ` · ${v.year}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12 }}>
                      {[
                        v.transmission === 'automatic' ? (lang === 'en' ? 'Automatic' : 'Automatik') : 'Manual',
                        `${v.seats} ${tr.seats}`,
                        ...(v.features || []).slice(0, 1),
                      ].map(f => (
                        <span key={f} style={{ fontSize: 11, padding: '3px 8px', background: '#f3f4f6', borderRadius: 20, color: '#6b7280' }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        {(isCorporate || hasPartnerDiscount) && (
                          <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through', marginRight: 4 }}>{originalPrice}€</span>
                        )}
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#1a56a0' }}>{displayPrice}€</span>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>{tr.perDay}</span>
                        {days && totalWithTransfer && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            {days} {tr.days} = <strong style={{ color: '#111' }}>{totalWithTransfer}€</strong>
                            {transferFee > 0 && <span style={{ fontSize: 10, color: '#BA7517' }}> (+{transferFee}€)</span>}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          + {lang === 'en' ? 'Deposit 300€ (on pickup)' : lang === 'de' ? 'Kaution 300€ (vor Ort)' : 'Depozit 300€ (pri preuzimanju)'}
                        </div>
                      </div>
                      <button onClick={() => handleBook(v)} style={{ padding: '8px 16px', background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {tr.book}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 40, marginBottom: 24 }}>
          {[
            { icon: '🛡️', title: lang === 'sr' ? 'Bez skrivenih troškova' : lang === 'en' ? 'No hidden fees' : 'Keine versteckten Kosten', desc: lang === 'sr' ? 'Cijena je konačna. Bez iznenađenja.' : lang === 'en' ? 'Final price. No surprises.' : 'Endpreis. Keine Überraschungen.' },
            { icon: '📍', title: lang === 'sr' ? 'Dostava na vašu adresu' : lang === 'en' ? 'Delivery to your address' : 'Lieferung zu Ihrer Adresse', desc: lang === 'sr' ? 'Aerodrom, hotel, apartman.' : lang === 'en' ? 'Airport, hotel, apartment.' : 'Flughafen, Hotel, Apartment.' },
            { icon: '💬', title: lang === 'sr' ? 'Podrška 24/7' : lang === 'en' ? '24/7 support' : '24/7 Support', desc: lang === 'sr' ? 'Uvijek dostupni za vas.' : lang === 'en' ? 'Always available for you.' : 'Immer für Sie erreichbar.' },
            { icon: '⭐', title: lang === 'sr' ? 'Provjereni na Balkanu' : lang === 'en' ? 'Trusted in the Balkans' : 'Vertrauenswürdig auf dem Balkan', desc: lang === 'sr' ? 'Iskustvo iz prve ruke.' : lang === 'en' ? 'First-hand experience.' : 'Aus erster Hand.' },
          ].map(item => (
            <div key={item.title} style={{ background: '#fff', borderRadius: 12, padding: '20px', border: '1px solid #c5d9f5', textAlign: 'center' as const }}>
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
            <a href="/blog" style={{ fontSize: 13, color: '#1a56a0', textDecoration: 'none', fontWeight: 600 }}>
              {lang === 'sr' ? 'Svi članci →' : lang === 'en' ? 'All articles →' : 'Alle Artikel →'}
            </a>
          </div>
          <div id="soro-blog" />
        </div>
      </div>

      <footer style={{ background: '#0e2d5e', padding: '32px 24px', marginTop: 40 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>ADRIA<span style={{ fontWeight: 300, color: '#4a90d9' }}>DRIVE</span></div>
            <div style={{ fontSize: 10, color: '#4a90d9', letterSpacing: 3 }}>BALKAN · RENT A CAR</div>
            <div style={{ fontSize: 12, color: '#7ab8f5', marginTop: 8, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>"Feel the Balkans. Own the road."</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            <a href="mailto:info@rent-cars.me" style={{ fontSize: 13, color: '#7ab8f5', textDecoration: 'none' }}>✉️ info@rent-cars.me</a>
            <a href="tel:+38269810805" style={{ fontSize: 13, color: '#7ab8f5', textDecoration: 'none' }}>📞 +382 69 810 805</a>
            <a href="https://wa.me/38269810805" style={{ fontSize: 13, color: '#7ab8f5', textDecoration: 'none' }}>💬 WhatsApp</a>
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
