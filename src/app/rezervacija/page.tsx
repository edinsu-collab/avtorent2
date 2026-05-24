'use client'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { translations, type Lang } from '@/lib/i18n'
import { calculateDays } from '@/lib/pricing'

type Extra = {
  id: string; name: string; name_en: string; name_de: string
  price: number; type: 'per_day' | 'fixed' | 'vehicle_per_day'
  is_vehicle_specific: boolean
}
type VehicleExtra = { extra_id: string; price: number }

const INSURANCE_OPTIONS = [
  { key: 'basic', label: 'Osnovno (AO)', labelEn: 'Basic (TPL)', labelDe: 'Basis (Haftpflicht)', desc: 'Standardna odgovornost prema trećima', price: 0 },
  { key: 'kasko_full', label: 'Full Kasko', labelEn: 'Full Casco', labelDe: 'Vollkasko', desc: 'Potpuna zaštita bez učešća', price: 15 },
  { key: 'kasko_ucesce', label: 'Kasko sa učešćem', labelEn: 'Casco with excess', labelDe: 'Kasko mit Selbstbeteiligung', desc: 'Kasko sa učešćem 300€', price: 8 },
]

const EXCLUDED_EXTRA_IDS = [
  'd18de2b4-9913-4387-83cc-d3407b21d4b4',
  '3ee49f93-3886-4095-9de3-5469be901797',
]

type DBLocation = { id: string; name: string; city: string; country: string }
type DBTransfer = { id: string; from_location_id: string; to_location_id: string; price: number }

const NATIONALITIES = [
  'Crna Gora', 'Srbija', 'Bosna i Hercegovina', 'Hrvatska', 'Slovenija',
  'Makedonija', 'Albanija', 'Njemačka', 'Austrija', 'Švicarska',
  'Italija', 'Francuska', 'UK', 'SAD', 'Rusija', 'Ostalo',
]

function BookingPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (searchParams.get('lang') as Lang) || 'sr'
  const vehicleId = searchParams.get('vehicleId') || ''
  const vehicleName = searchParams.get('vehicleName') || ''
  const vehicleCategory = searchParams.get('vehicleCategory') || ''
  const vehicleSeats = searchParams.get('vehicleSeats') || ''
  const vehicleTransmission = searchParams.get('vehicleTransmission') || ''
  const vehicleYear = searchParams.get('vehicleYear') || ''
  const vehicleImage = searchParams.get('vehicleImage') || ''
  const pricePerDay = parseFloat(searchParams.get('pricePerDay') || '0')
  const qrRef = searchParams.get('ref') || ''
  const partnerName = searchParams.get('partnerName') || ''
  const partnerDiscount = parseFloat(searchParams.get('partnerDiscount') || '0')
  const siteDomain = searchParams.get('siteDomain') || ''
  const tr = translations[lang]

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState({
    guestName: '', guestEmail: '', guestPhone: '',
    guestNationality: '', guestDob: '', guestLicense: '',
    pickupDate: searchParams.get('pickupDate') || '',
    returnDate: searchParams.get('returnDate') || '',
    pickupTime: searchParams.get('pickupTime') || '10:00',
    returnTime: searchParams.get('returnTime') || '10:00',
    pickupLocation: searchParams.get('pickupLocation') || '',
    pickupLocationCustom: '',
    dropoffLocation: searchParams.get('dropoffLocation') || '',
    dropoffLocationCustom: '',
    transferFee: parseFloat(searchParams.get('transferFee') || '0'),
    sameDropoff: !searchParams.get('dropoffLocation') || searchParams.get('dropoffLocation') === searchParams.get('pickupLocation'),
    hasSecondDriver: false,
    driver2Name: '', driver2License: '', driver2Nationality: '',
    insurance: 'basic',
    notes: '', flightNumber: '',
    borderCrossing: 'allowed',
  })

  const [extras, setExtras] = useState<Extra[]>([])
  const [vehicleExtras, setVehicleExtras] = useState<VehicleExtra[]>([])
  const [dbLocations, setDbLocations] = useState<DBLocation[]>([])
  const [dbTransfers, setDbTransfers] = useState<DBTransfer[]>([])
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({})
  const [couponCode, setCouponCode] = useState('')
  const [couponData, setCouponData] = useState<{ discount_percent: number } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const days = form.pickupDate && form.returnDate
    ? calculateDays(form.pickupDate, form.pickupTime, form.returnDate, form.returnTime)
    : parseInt(searchParams.get('days') || '1')

  useEffect(() => {
    fetch(`/api/extras?vehicleId=${vehicleId}`)
      .then(r => r.json())
      .then(d => { setExtras(d.extras || []); setVehicleExtras(d.vehicleExtras || []) })
      .catch(() => {})
    fetch('/api/locations')
      .then(r => r.json())
      .then(d => { setDbLocations(d.locations || []); setDbTransfers(d.transfers || []) })
      .catch(() => {})
  }, [vehicleId])

  const filteredExtras = extras.filter(e => !EXCLUDED_EXTRA_IDS.includes(e.id))

  function calcTransferFee(fromName: string, toName: string): number {
    if (!fromName || !toName || fromName === toName) return 0
    const fromLoc = dbLocations.find(l => l.name === fromName)
    const toLoc = dbLocations.find(l => l.name === toName)
    if (!fromLoc || !toLoc) return 0
    const t = dbTransfers.find(t => t.from_location_id === fromLoc.id && t.to_location_id === toLoc.id)
    return t?.price || 0
  }

  function getExtraPrice(extra: Extra): number {
    if (extra.is_vehicle_specific) {
      const ve = vehicleExtras.find(ve => ve.extra_id === extra.id)
      return ve ? ve.price : extra.price
    }
    return extra.price
  }

  function getExtraTotal(extra: Extra): number {
    const price = getExtraPrice(extra)
    return extra.type === 'fixed' ? price : price * days
  }

  const selectedInsurance = INSURANCE_OPTIONS.find(i => i.key === form.insurance) || INSURANCE_OPTIONS[0]
  const insuranceTotal = selectedInsurance.price * days
  const originalBasePrice = pricePerDay * days
  const partnerDiscountAmount = partnerDiscount > 0 ? Math.round(originalBasePrice * (partnerDiscount / 100) * 100) / 100 : 0
  const basePrice = originalBasePrice - partnerDiscountAmount
  const extrasTotal = filteredExtras.filter(e => selectedExtras[e.id]).reduce((sum, e) => sum + getExtraTotal(e), 0)
  const subtotalAfterPartner = basePrice + extrasTotal + insuranceTotal + form.transferFee
  const couponDiscountAmount = couponData ? Math.round(subtotalAfterPartner * (couponData.discount_percent / 100) * 100) / 100 : 0
  const total = subtotalAfterPartner - couponDiscountAmount

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true); setCouponError('')
    try {
      const res = await fetch(`/api/coupons?code=${couponCode.trim().toUpperCase()}`)
      const data = await res.json()
      if (!data || !data.is_active) { setCouponError('Kupon nije validan.'); setCouponData(null) }
      else setCouponData(data)
    } catch { setCouponError('Greška pri provjeri.') }
    setCouponLoading(false)
  }

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!form.guestName.trim()) e.guestName = 'Obavezno polje'
    if (!form.guestEmail.trim() || !form.guestEmail.includes('@')) e.guestEmail = 'Unesite validnu email adresu'
    if (!form.guestPhone.trim()) e.guestPhone = 'Obavezno polje'
    if (!form.guestNationality) e.guestNationality = 'Obavezno polje'
    if (!form.guestLicense.trim()) e.guestLicense = 'Obavezno polje'
    setErrors(e); return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e: Record<string, string> = {}
    if (!form.pickupDate) e.pickupDate = 'Obavezno polje'
    if (!form.returnDate) e.returnDate = 'Obavezno polje'
    const pickupLoc = form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation
    if (!pickupLoc?.trim()) e.pickupLocation = 'Odaberite lokaciju'
    if (form.pickupDate && form.returnDate && form.returnDate < form.pickupDate) e.returnDate = 'Datum povratka ne može biti prije preuzimanja'
    setErrors(e); return Object.keys(e).length === 0
  }

  function nextStep() {
    if (step === 1 && validateStep1()) setStep(2)
    else if (step === 2 && validateStep2()) setStep(3)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep1() || !validateStep2()) return
    setSubmitting(true)
    const resolvedPickup = form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation
    const resolvedDropoff = form.sameDropoff ? resolvedPickup : (form.dropoffLocation === '__custom' ? form.dropoffLocationCustom : form.dropoffLocation)
    const selectedExtrasList = filteredExtras.filter(ex => selectedExtras[ex.id]).map(ex => ({
      extraId: ex.id,
      extraName: lang === 'en' ? ex.name_en : lang === 'de' ? ex.name_de : ex.name,
      pricePerUnit: getExtraPrice(ex), days: ex.type === 'fixed' ? 1 : days,
      totalPrice: getExtraTotal(ex), type: ex.type,
    }))
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId, partnerQrCode: qrRef || null,
          guestName: form.guestName, guestEmail: form.guestEmail,
          guestPhone: form.guestPhone, guestNationality: form.guestNationality,
          guestLicense: form.guestLicense, guestDob: form.guestDob,
          pickupDate: form.pickupDate, returnDate: form.returnDate,
          pickupTime: form.pickupTime, returnTime: form.returnTime,
          pickupLocation: resolvedPickup, dropoffLocation: resolvedDropoff,
          transferFee: form.transferFee,
          hasSecondDriver: form.hasSecondDriver,
          driver2Name: form.driver2Name, driver2License: form.driver2License,
          driver2Nationality: form.driver2Nationality,
          insurance: form.insurance, insuranceTotal,
          borderCrossing: form.borderCrossing,
          flightNumber: form.flightNumber,
          notes: form.notes, lang,
          extras: selectedExtrasList,
          couponCode: couponData ? couponCode.trim().toUpperCase() : null,
          couponDiscountPercent: couponData?.discount_percent || null,
          couponDiscountAmount: couponDiscountAmount || null,
          partnerDiscountPercent: partnerDiscount || null,
          partnerDiscountAmount: partnerDiscountAmount || null,
          siteDomain: siteDomain || null,
          extrasTotal, basePrice: originalBasePrice, totalPrice: total,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(tr.errFailed); setSubmitting(false); return }
      router.push(`/vozila/potvrda?ref=${data.refCode}&lang=${lang}&partnerName=${encodeURIComponent(partnerName)}&partnerDiscount=${partnerDiscount}&isNewClient=${data.isNewClient ? 'true' : 'false'}`)
    } catch { alert(tr.errFailed); setSubmitting(false) }
  }

  const inp = (err?: string): React.CSSProperties => ({ width: '100%', padding: '10px 12px', fontSize: 14, border: `1.5px solid ${err ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box', outline: 'none' })
  const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }
  const errStyle: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 }
  const extraName = (e: Extra) => lang === 'en' ? (e.name_en || e.name) : lang === 'de' ? (e.name_de || e.name) : e.name
  const typeLabel = (e: Extra) => e.type === 'fixed' ? 'fiksno' : `${getExtraPrice(e)}€ × ${days} dana`
  const insLabel = (ins: typeof INSURANCE_OPTIONS[0]) => lang === 'en' ? ins.labelEn : lang === 'de' ? ins.labelDe : ins.label

  return (
    <div style={{ minHeight: '100vh', background: '#f0f6ff' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => step > 1 ? setStep(s => (s - 1) as 1|2|3) : router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', padding: '4px 8px' }}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1a56a0', letterSpacing: -0.5 }}>ADRIA<span style={{ fontWeight: 300, color: '#4a90d9', letterSpacing: 2 }}>DRIVE</span></div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= s ? '#1a56a0' : '#e5e7eb', color: step >= s ? '#fff' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{s}</div>
              {s < 3 && <div style={{ width: 20, height: 2, background: step > s ? '#1a56a0' : '#e5e7eb' }} />}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
            {step === 1 ? 'Vaši podaci' : step === 2 ? 'Termin' : 'Pregled'}
          </div>
        </div>
      </nav>

      <style>{`
        @media (max-width: 640px) { .form-grid-2 { grid-template-columns: 1fr !important; } }
        input:focus, select:focus, textarea:focus { border-color: #1a56a0 !important; box-shadow: 0 0 0 3px rgba(26,86,160,0.1); }
      `}</style>

      <main style={{ maxWidth: 680, margin: '24px auto', padding: '0 16px 60px' }}>
        {/* Vozilo kartica */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
          {vehicleImage
            ? <img src={vehicleImage} alt={vehicleName} style={{ width: 100, height: 66, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
            : <div style={{ width: 100, height: 66, background: '#f3f4f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🚗</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 5 }}>{vehicleName}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
              {vehicleCategory && <span style={{ fontSize: 11, background: '#f0f6ff', border: '1px solid #dbeafe', borderRadius: 20, padding: '2px 8px', color: '#1a56a0' }}>{vehicleCategory}</span>}
              {vehicleSeats && <span style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 20, padding: '2px 8px', color: '#6b7280' }}>👥 {vehicleSeats}</span>}
              {vehicleTransmission && <span style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 20, padding: '2px 8px', color: '#6b7280' }}>⚙️ {vehicleTransmission === 'automatic' ? 'Automatik' : 'Manual'}</span>}
              {vehicleYear && <span style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 20, padding: '2px 8px', color: '#6b7280' }}>{vehicleYear}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {partnerDiscount > 0 && <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{pricePerDay}€/dan</span>}
              <span style={{ color: '#1a56a0', fontWeight: 800, fontSize: 16 }}>{Math.round(pricePerDay * (1 - partnerDiscount / 100) * 100) / 100}€<span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>/dan</span></span>
              {days > 0 && <span style={{ fontSize: 11, color: '#6b7280' }}>· {days} dana = <strong style={{ color: '#1a56a0' }}>{basePrice.toFixed(2)}€</strong></span>}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* KORAK 1 */}
          {step === 1 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 }}>👤 Vaši podaci</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Molimo unesite tačne podatke koji odgovaraju vašoj vozačkoj dozvoli</div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Ime i Prezime *</label>
                  <input style={inp(errors.guestName)} value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} placeholder="Marko Petrović" />
                  {errors.guestName && <div style={errStyle}>{errors.guestName}</div>}
                </div>
                <div>
                  <label style={lbl}>Email adresa *</label>
                  <input type="email" style={inp(errors.guestEmail)} value={form.guestEmail} onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))} placeholder="marko@email.com" />
                  {errors.guestEmail && <div style={errStyle}>{errors.guestEmail}</div>}
                </div>
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Telefon *</label>
                  <input style={inp(errors.guestPhone)} value={form.guestPhone} onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} placeholder="+382 67 000 000" />
                  {errors.guestPhone && <div style={errStyle}>{errors.guestPhone}</div>}
                </div>
                <div>
                  <label style={lbl}>Datum rođenja</label>
                  <input type="date" style={inp()} value={form.guestDob} onChange={e => setForm(f => ({ ...f, guestDob: e.target.value }))} />
                </div>
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={lbl}>Nacionalnost *</label>
                  <select style={inp(errors.guestNationality)} value={form.guestNationality} onChange={e => setForm(f => ({ ...f, guestNationality: e.target.value }))}>
                    <option value="">-- Odaberi --</option>
                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {errors.guestNationality && <div style={errStyle}>{errors.guestNationality}</div>}
                </div>
                <div>
                  <label style={lbl}>Broj vozačke dozvole *</label>
                  <input style={inp(errors.guestLicense)} value={form.guestLicense} onChange={e => setForm(f => ({ ...f, guestLicense: e.target.value }))} placeholder="npr. 001234567" />
                  {errors.guestLicense && <div style={errStyle}>{errors.guestLicense}</div>}
                </div>
              </div>

              {/* Drugi vozač */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.hasSecondDriver ? 14 : 0 }}>
                  <input type="checkbox" checked={form.hasSecondDriver} onChange={e => setForm(f => ({ ...f, hasSecondDriver: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1a56a0' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Dodaj drugog vozača</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Opciono — za slučaj izmjene vozača tokom najma</div>
                  </div>
                </label>
                {form.hasSecondDriver && (
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={lbl}>Ime i Prezime</label><input style={inp()} value={form.driver2Name} onChange={e => setForm(f => ({ ...f, driver2Name: e.target.value }))} placeholder="Ana Petrović" /></div>
                    <div><label style={lbl}>Broj vozačke</label><input style={inp()} value={form.driver2License} onChange={e => setForm(f => ({ ...f, driver2License: e.target.value }))} /></div>
                    <div>
                      <label style={lbl}>Nacionalnost</label>
                      <select style={inp()} value={form.driver2Nationality} onChange={e => setForm(f => ({ ...f, driver2Nationality: e.target.value }))}>
                        <option value="">-- Odaberi --</option>
                        {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" onClick={nextStep} style={{ width: '100%', padding: 13, background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Nastavi →
              </button>
            </div>
          )}

          {/* KORAK 2 */}
          {step === 2 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 }}>📅 Termin najma</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Odaberite datume, lokacije i dodatnu opremu</div>

              {/* Datumi */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Datumi i vremena</div>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>Datum preuzimanja *</label>
                    <input type="date" style={inp(errors.pickupDate)} value={form.pickupDate} onChange={e => setForm(f => ({ ...f, pickupDate: e.target.value }))} />
                    {errors.pickupDate && <div style={errStyle}>{errors.pickupDate}</div>}
                  </div>
                  <div>
                    <label style={lbl}>Sat preuzimanja</label>
                    <input type="time" style={inp()} value={form.pickupTime} onChange={e => setForm(f => ({ ...f, pickupTime: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Datum povratka *</label>
                    <input type="date" style={inp(errors.returnDate)} value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} />
                    {errors.returnDate && <div style={errStyle}>{errors.returnDate}</div>}
                  </div>
                  <div>
                    <label style={lbl}>Sat povratka</label>
                    <input type="time" style={inp()} value={form.returnTime} onChange={e => setForm(f => ({ ...f, returnTime: e.target.value }))} />
                  </div>
                </div>
                {days > 0 && (
                  <div style={{ background: '#dbeafe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1e40af', fontWeight: 500 }}>
                    📅 Trajanje: <strong>{days} {days === 1 ? 'dan' : 'dana'}</strong> · Cijena najma: <strong>{basePrice.toFixed(2)}€</strong>
                  </div>
                )}
              </div>

              {/* Lokacije */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>📍 Lokacije</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Lokacija preuzimanja *</label>
                  <select style={inp(errors.pickupLocation)} value={form.pickupLocation} onChange={e => setForm(f => ({ ...f, pickupLocation: e.target.value }))}>
                    <option value="">-- Odaberi lokaciju --</option>
                    {dbLocations.map(l => <option key={l.id} value={l.name}>{l.name} ({l.country})</option>)}
                    <option value="__custom">Druga lokacija...</option>
                  </select>
                  {form.pickupLocation === '__custom' && (
                    <input style={{ ...inp(errors.pickupLocation), marginTop: 6 }} value={form.pickupLocationCustom} onChange={e => setForm(f => ({ ...f, pickupLocationCustom: e.target.value }))} placeholder="Unesite adresu..." />
                  )}
                  {errors.pickupLocation && <div style={errStyle}>{errors.pickupLocation}</div>}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={form.sameDropoff} onChange={e => setForm(f => ({ ...f, sameDropoff: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#1a56a0' }} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Vraćam vozilo na istu lokaciju</span>
                </label>

                {!form.sameDropoff && (
                  <div>
                    <label style={lbl}>Lokacija vraćanja</label>
                    <select style={inp()} value={form.dropoffLocation} onChange={e => {
                      const dropoff = e.target.value
                      const fee = calcTransferFee(form.pickupLocation, dropoff)
                      setForm(f => ({ ...f, dropoffLocation: dropoff, transferFee: fee }))
                    }}>
                      <option value="">-- Odaberi lokaciju --</option>
                      {dbLocations.map(l => <option key={l.id} value={l.name}>{l.name} ({l.country})</option>)}
                      <option value="__custom">Druga lokacija...</option>
                    </select>
                    {form.dropoffLocation === '__custom' && (
                      <input style={{ ...inp(), marginTop: 6 }} value={form.dropoffLocationCustom} onChange={e => setForm(f => ({ ...f, dropoffLocationCustom: e.target.value }))} placeholder="Unesite adresu..." />
                    )}
                    {form.transferFee > 0 && (
                      <div style={{ fontSize: 12, color: '#085041', background: '#E1F5EE', padding: '5px 10px', borderRadius: 6, marginTop: 4 }}>
                        Naknada za transfer: <strong>{form.transferFee}€</strong>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 10 }}>
                  <label style={lbl}>Broj leta (opciono — za aerodromska preuzimanja)</label>
                  <input style={inp()} value={form.flightNumber} onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value }))} placeholder="npr. FR1234" />
                </div>
              </div>

              {/* Osiguranje */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>🛡️ Osiguranje</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {INSURANCE_OPTIONS.map(ins => (
                    <label key={ins.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: `2px solid ${form.insurance === ins.key ? '#1a56a0' : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer', background: form.insurance === ins.key ? '#f0f6ff' : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="radio" name="insurance" value={ins.key} checked={form.insurance === ins.key} onChange={() => setForm(f => ({ ...f, insurance: ins.key }))} style={{ width: 16, height: 16, accentColor: '#1a56a0' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{insLabel(ins)}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{ins.desc}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: form.insurance === ins.key ? '#1a56a0' : '#374151', whiteSpace: 'nowrap', marginLeft: 10 }}>
                        {ins.price === 0 ? 'Uključeno' : `+${ins.price}€/dan`}
                        {ins.price > 0 && <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{ins.price * days}€ ukupno</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Granica */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>🌍 Vožnja van granice CG</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['allowed','✅ Dozvoljeno','#085041','#E1F5EE'],['forbidden','🚫 Zabranjeno','#DC2626','#FEE2E2']].map(([val, label, color, bg]) => (
                    <button key={val} type="button" onClick={() => setForm(f => ({ ...f, borderCrossing: val }))}
                      style={{ flex: 1, padding: '8px', fontSize: 12, border: `1px solid ${form.borderCrossing === val ? color : '#e5e7eb'}`, borderRadius: 8, background: form.borderCrossing === val ? bg : '#fff', color: form.borderCrossing === val ? color : '#6b7280', cursor: 'pointer', fontWeight: form.borderCrossing === val ? 600 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dodaci */}
              {filteredExtras.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>🎒 Dodaci i oprema</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredExtras.map(extra => (
                      <label key={extra.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1.5px solid ${selectedExtras[extra.id] ? '#1a56a0' : '#e5e7eb'}`, borderRadius: 8, cursor: 'pointer', background: selectedExtras[extra.id] ? '#f0f6ff' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="checkbox" checked={!!selectedExtras[extra.id]} onChange={e => setSelectedExtras(s => ({ ...s, [extra.id]: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1a56a0' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{extraName(extra)}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{typeLabel(extra)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: selectedExtras[extra.id] ? '#1a56a0' : '#374151' }}>{getExtraTotal(extra)}€</div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Napomena */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Napomena (opciono)</label>
                <textarea style={{ ...inp(), minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Posebni zahtjevi, informacije o dolasku..." />
              </div>

              {/* Kupon */}
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Kupon kod (opciono)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inp(), flex: 1 }} value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponData(null); setCouponError('') }} placeholder="KUPON123" />
                  <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} style={{ padding: '10px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}>
                    {couponLoading ? '...' : 'Primijeni'}
                  </button>
                </div>
                {couponError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{couponError}</div>}
                {couponData && <div style={{ fontSize: 12, color: '#1a56a0', marginTop: 4 }}>✓ Popust {couponData.discount_percent}% je primijenjen!</div>}
              </div>

              <button type="button" onClick={nextStep} style={{ width: '100%', padding: 13, background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Nastavi na pregled →
              </button>
            </div>
          )}

          {/* KORAK 3 */}
          {step === 3 && (
            <div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 }}>✅ Pregled rezervacije</div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>👤 Vozač</div>
                  {[['Ime i Prezime', form.guestName], ['Email', form.guestEmail], ['Telefon', form.guestPhone], ['Nacionalnost', form.guestNationality], ['Datum rođenja', form.guestDob], ['Broj vozačke', form.guestLicense]].filter(([,v]) => v).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #f9fafb' }}>
                      <span style={{ color: '#6b7280' }}>{l}</span><span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>📅 Termin</div>
                  {[
                    ['Preuzimanje', `${form.pickupDate} u ${form.pickupTime}`],
                    ['Povratak', `${form.returnDate} u ${form.returnTime}`],
                    ['Lokacija preuzimanja', form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation],
                    ['Lokacija vraćanja', form.sameDropoff ? (form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation) : (form.dropoffLocation === '__custom' ? form.dropoffLocationCustom : form.dropoffLocation)],
                    ['Broj leta', form.flightNumber],
                    ['Granica', form.borderCrossing === 'allowed' ? '✅ Dozvoljeno van CG' : '🚫 Zabranjeno van CG'],
                  ].filter(([,v]) => v).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #f9fafb' }}>
                      <span style={{ color: '#6b7280' }}>{l}</span><span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Obračun */}
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>💰 Obračun</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#6b7280' }}>
                    <span>Najam ({days} dana × {Math.round(pricePerDay * (1 - partnerDiscount / 100) * 100) / 100}€)</span>
                    <span>{basePrice.toFixed(2)}€</span>
                  </div>
                  {partnerDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#1a56a0' }}>
                      <span>🎁 Popust {partnerName} ({partnerDiscount}%)</span><span>-{partnerDiscountAmount.toFixed(2)}€</span>
                    </div>
                  )}
                  {form.insurance !== 'basic' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#6b7280' }}>
                      <span>🛡️ {insLabel(selectedInsurance)}</span><span>{insuranceTotal}€</span>
                    </div>
                  )}
                  {filteredExtras.filter(e => selectedExtras[e.id]).map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#6b7280' }}>
                      <span>{extraName(e)}</span><span>{getExtraTotal(e)}€</span>
                    </div>
                  ))}
                  {form.transferFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#6b7280' }}>
                      <span>🚗 Transfer naknada</span><span>{form.transferFee}€</span>
                    </div>
                  )}
                  {couponData && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#1a56a0' }}>
                      <span>Kupon ({couponData.discount_percent}%)</span><span>-{couponDiscountAmount.toFixed(2)}€</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, padding: '12px 0 4px', marginTop: 8, borderTop: '2px solid #e5e7eb', color: '#111' }}>
                    <span>Ukupno</span><span style={{ color: '#1a56a0' }}>{total.toFixed(2)}€</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>+ Depozit 300€ (plaća se na licu mjesta)</div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>Slanjem rezervacije potvrđujem:</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>Uslovi korištenja vozila su mi poznati i prihvatam ih</li>
                  <li>Podaci koje sam unio/la su tačni i odgovaraju mojoj vozačkoj dozvoli</li>
                  <li>Depozit od 300€ plaćam gotovinom pri preuzimanju vozila</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(2)} style={{ flex: 1, padding: 13, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Nazad</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: 13, background: submitting ? '#4a90d9' : '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? '⏳ Slanje...' : '🎉 Potvrdi rezervaciju'}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Učitavanje...</div>}>
      <BookingPageContent />
    </Suspense>
  )
}
