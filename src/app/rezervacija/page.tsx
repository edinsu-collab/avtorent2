'use client'

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

export default function BookingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const lang = (searchParams.get('lang') as Lang) || 'sr'
  const vehicleId = searchParams.get('vehicleId') || ''
  const vehicleName = searchParams.get('vehicleName') || ''
  const pricePerDay = parseFloat(searchParams.get('pricePerDay') || '0')
  const qrRef = searchParams.get('ref') || ''
  const partnerName = searchParams.get('partnerName') || ''
  const partnerDiscount = parseFloat(searchParams.get('partnerDiscount') || '0')
  const tr = translations[lang]

  const [form, setForm] = useState({
    guestName: '', guestEmail: '', guestPhone: '', guestNationality: '',
    pickupDate: searchParams.get('pickupDate') || '',
    returnDate: searchParams.get('returnDate') || '',
    pickupTime: searchParams.get('pickupTime') || '10:00',
    returnTime: searchParams.get('returnTime') || '10:00',
    pickupLocation: '', notes: '',
  })
  const [extras, setExtras] = useState<Extra[]>([])
  const [vehicleExtras, setVehicleExtras] = useState<VehicleExtra[]>([])
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
  }, [vehicleId])

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

  const originalBasePrice = pricePerDay * days
  const partnerDiscountAmount = partnerDiscount > 0 ? Math.round(originalBasePrice * (partnerDiscount / 100) * 100) / 100 : 0
  const basePrice = originalBasePrice - partnerDiscountAmount
  const extrasTotal = extras.filter(e => selectedExtras[e.id]).reduce((sum, e) => sum + getExtraTotal(e), 0)
  const subtotalAfterPartner = basePrice + extrasTotal
  const couponDiscountAmount = couponData ? Math.round(subtotalAfterPartner * (couponData.discount_percent / 100) * 100) / 100 : 0
  const total = subtotalAfterPartner - couponDiscountAmount

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const res = await fetch(`/api/coupons?code=${couponCode.trim().toUpperCase()}`)
      const data = await res.json()
      if (!data || !data.is_active) { setCouponError('Kupon nije validan.'); setCouponData(null) }
      else setCouponData(data)
    } catch { setCouponError('Greška pri provjeri.') }
    setCouponLoading(false)
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.guestName.trim()) e.guestName = tr.errRequired
    if (!form.guestEmail.trim() || !form.guestEmail.includes('@')) e.guestEmail = tr.errEmail
    if (!form.guestPhone.trim()) e.guestPhone = tr.errRequired
    if (!form.pickupDate) e.pickupDate = tr.errRequired
    if (!form.returnDate) e.returnDate = tr.errRequired
    if (!form.pickupLocation.trim()) e.pickupLocation = tr.errRequired
    if (form.pickupDate && form.returnDate && form.returnDate < form.pickupDate) e.returnDate = tr.errDates
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    const selectedExtrasList = extras.filter(ex => selectedExtras[ex.id]).map(ex => ({
      extraId: ex.id,
      extraName: lang === 'en' ? ex.name_en : lang === 'de' ? ex.name_de : ex.name,
      pricePerUnit: getExtraPrice(ex), days: ex.type === 'fixed' ? 1 : days,
      totalPrice: getExtraTotal(ex), type: ex.type,
    }))
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId, partnerQrCode: qrRef || null, ...form, lang,
          extras: selectedExtrasList,
          couponCode: couponData ? couponCode.trim().toUpperCase() : null,
          couponDiscountPercent: couponData?.discount_percent || null,
          couponDiscountAmount: couponDiscountAmount || null,
          partnerDiscountPercent: partnerDiscount || null,
          partnerDiscountAmount: partnerDiscountAmount || null,
          extrasTotal, basePrice: originalBasePrice, totalPrice: total,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(tr.errFailed); setSubmitting(false); return }
      router.push(`/vozila/potvrda?ref=${data.refCode}&lang=${lang}&partnerName=${encodeURIComponent(partnerName)}&partnerDiscount=${partnerDiscount}&isNewClient=${data.isNewClient ? 'true' : 'false'}`)
    } catch { alert(tr.errFailed); setSubmitting(false) }
  }

  const inp = (err?: string) => ({ width: '100%', padding: '9px 12px', fontSize: 14, border: `1px solid ${err ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const })
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }
  const errStyle = { fontSize: 11, color: '#ef4444', marginTop: 3 }
  const extraName = (e: Extra) => lang === 'en' ? (e.name_en || e.name) : lang === 'de' ? (e.name_de || e.name) : e.name
  const typeLabel = (e: Extra) => e.type === 'fixed' ? 'fiksno' : `${getExtraPrice(e)}€ × ${days} dana`

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>Avto<span style={{ color: '#1D9E75' }}>Rent</span></div>
      </nav>

      <main style={{ maxWidth: 620, margin: '24px auto', padding: '0 16px 48px' }}>
        <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '28px 24px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#111' }}>{tr.bookTitle}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>{tr.bookSub}</p>

          {partnerName && partnerDiscount > 0 && (
            <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#085041', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🎁 <span>Kao gost apartmana <strong>{partnerName}</strong> ostvarujete <strong>{partnerDiscount}% popusta</strong> na cijenu najma!</span>
            </div>
          )}

          <div style={{ background: '#f0fdf8', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{vehicleName}</span>
            <div style={{ textAlign: 'right' }}>
              {partnerDiscount > 0 && <div style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>{pricePerDay}€/dan</div>}
              <span style={{ color: '#1D9E75', fontWeight: 700, fontSize: 14 }}>{Math.round(pricePerDay * (1 - partnerDiscount / 100) * 100) / 100}€/dan</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={lbl}>{tr.guestName}</label><input style={inp(errors.guestName)} value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} placeholder="Marko Petrović" />{errors.guestName && <div style={errStyle}>{errors.guestName}</div>}</div>
            <div><label style={lbl}>{tr.email}</label><input type="email" style={inp(errors.guestEmail)} value={form.guestEmail} onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))} placeholder="marko@email.com" />{errors.guestEmail && <div style={errStyle}>{errors.guestEmail}</div>}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={lbl}>{tr.phone}</label><input style={inp(errors.guestPhone)} value={form.guestPhone} onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} placeholder="+382 67 000 000" />{errors.guestPhone && <div style={errStyle}>{errors.guestPhone}</div>}</div>
            <div><label style={lbl}>{tr.nationality}</label><input style={inp()} value={form.guestNationality} onChange={e => setForm(f => ({ ...f, guestNationality: e.target.value }))} placeholder="Crnogorska" /></div>
          </div>

          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Datumi i vremena</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>{tr.pickupDate}</label><input type="date" style={inp(errors.pickupDate)} value={form.pickupDate} onChange={e => setForm(f => ({ ...f, pickupDate: e.target.value }))} />{errors.pickupDate && <div style={errStyle}>{errors.pickupDate}</div>}</div>
              <div><label style={lbl}>Vrijeme preuzimanja</label><input type="time" style={inp()} value={form.pickupTime} onChange={e => setForm(f => ({ ...f, pickupTime: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div><label style={lbl}>{tr.returnDate}</label><input type="date" style={inp(errors.returnDate)} value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} />{errors.returnDate && <div style={errStyle}>{errors.returnDate}</div>}</div>
              <div><label style={lbl}>Vrijeme vraćanja</label><input type="time" style={inp()} value={form.returnTime} onChange={e => setForm(f => ({ ...f, returnTime: e.target.value }))} /></div>
            </div>
            <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#085041', fontWeight: 500 }}>
              Trajanje: {days} {days === 1 ? 'dan' : 'dana'} · Najam: {basePrice.toFixed(2)}€
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>{tr.pickupLoc}</label>
            <input style={inp(errors.pickupLocation)} value={form.pickupLocation} onChange={e => setForm(f => ({ ...f, pickupLocation: e.target.value }))} placeholder={tr.pickupPlaceholder} />
            {errors.pickupLocation && <div style={errStyle}>{errors.pickupLocation}</div>}
          </div>

          {extras.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Dodaci i oprema</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {extras.map(extra => (
                  <label key={extra.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1px solid ${selectedExtras[extra.id] ? '#5DCAA5' : '#e5e7eb'}`, borderRadius: 8, cursor: 'pointer', background: selectedExtras[extra.id] ? '#f0fdf8' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" checked={!!selectedExtras[extra.id]} onChange={e => setSelectedExtras(s => ({ ...s, [extra.id]: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1D9E75' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{extraName(extra)}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{typeLabel(extra)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: selectedExtras[extra.id] ? '#1D9E75' : '#374151' }}>{getExtraTotal(extra)}€</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>{tr.notes}</label>
            <textarea style={{ ...inp(), minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={tr.notesPlaceholder} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Kupon kod (opciono)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp(), flex: 1 }} value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponData(null); setCouponError('') }} placeholder="KUPON123" />
              <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} style={{ padding: '9px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}>
                {couponLoading ? '...' : 'Primijeni'}
              </button>
            </div>
            {couponError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{couponError}</div>}
            {couponData && <div style={{ fontSize: 12, color: '#1D9E75', marginTop: 4 }}>✓ Popust {couponData.discount_percent}% je primijenjen!</div>}
          </div>

          {/* Obračun */}
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 10 }}>Obračun</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#6b7280' }}>
              <span>Najam vozila ({days} {tr.days})</span>
              <span>{partnerDiscount > 0 ? <><s style={{ marginRight: 4 }}>{originalBasePrice.toFixed(2)}€</s>{basePrice.toFixed(2)}€</> : `${basePrice.toFixed(2)}€`}</span>
            </div>
            {partnerDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#1D9E75' }}>
                <span>🎁 Popust gosta apartmana ({partnerDiscount}%)</span>
                <span>-{partnerDiscountAmount.toFixed(2)}€</span>
              </div>
            )}
            {extras.filter(e => selectedExtras[e.id]).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#6b7280' }}><span>{extraName(e)}</span><span>{getExtraTotal(e)}€</span></div>
            ))}
            {couponData && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#1D9E75' }}>
                <span>Kupon ({couponData.discount_percent}%)</span><span>-{couponDiscountAmount.toFixed(2)}€</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, padding: '10px 0 0', marginTop: 8, borderTop: '1px solid #e5e7eb', color: '#111' }}>
              <span>{tr.total}</span><span style={{ color: '#1D9E75' }}>{total.toFixed(2)}€</span>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Depozit: 300€ (na licu mjesta)</div>
          </div>

          <button type="submit" disabled={submitting} style={{ width: '100%', padding: 13, background: submitting ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? '...' : tr.submit}
          </button>
        </form>
      </main>
    </div>
  )
}
