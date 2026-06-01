'use client'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
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
  { key: 'basic', label: 'Osnovno (AO)', labelEn: 'Basic (TPL)', labelDe: 'Basis (Haftpflicht)', labelTr: 'Temel (Sorumluluk)', labelRu: 'Базовое (ОСАГО)', labelEs: 'Básico (TPL)', labelFr: 'Basique (RC)', labelAr: 'أساسي', desc: 'Standardna odgovornost prema trećima', price: 0 },
  { key: 'kasko_full', label: 'Full Kasko', labelEn: 'Full Casco', labelDe: 'Vollkasko', labelTr: 'Tam Kasko', labelRu: 'Полное КАСКО', labelEs: 'Casco completo', labelFr: 'Casco complet', labelAr: 'تأمين شامل', desc: 'Potpuna zaštita bez učešća', price: 15 },
  { key: 'kasko_ucesce', label: 'Kasko sa učešćem', labelEn: 'Casco with excess', labelDe: 'Kasko mit Selbstbeteiligung', labelTr: 'Katılımlı Kasko', labelRu: 'КАСКО с франшизой', labelEs: 'Casco con franquicia', labelFr: 'Casco avec franchise', labelAr: 'تأمين مع مشاركة', desc: 'Kasko sa učešćem 300€', price: 8 },
]

const EXCLUDED_EXTRA_IDS = [
  'd18de2b4-9913-4387-83cc-d3407b21d4b4',
  '3ee49f93-3886-4095-9de3-5469be901797',
]

type DBLocation = { id: string; name: string; city: string; country: string }
type DBTransfer = { id: string; from_location_id: string; to_location_id: string; price: number }

const NATIONALITIES = [
  'Montenegro', 'Serbia', 'Bosnia and Herzegovina', 'Croatia', 'Slovenia',
  'North Macedonia', 'Albania', 'Germany', 'Austria', 'Switzerland',
  'Italy', 'France', 'UK', 'USA', 'Russia', 'Turkey', 'UAE', 'Other',
]

// Pozivni brojevi po zemlji — za auto-prefiks telefona
const DIAL_CODES: Record<string, string> = {
  'Montenegro': '+382', 'Serbia': '+381', 'Bosnia and Herzegovina': '+387',
  'Croatia': '+385', 'Slovenia': '+386', 'North Macedonia': '+389',
  'Albania': '+355', 'Germany': '+49', 'Austria': '+43', 'Switzerland': '+41',
  'Italy': '+39', 'France': '+33', 'UK': '+44', 'USA': '+1',
  'Russia': '+7', 'Turkey': '+90', 'UAE': '+971',
}

function BookingPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  // Lang carried from homepage search through entire flow
  const lang = ((searchParams.get('lang') || 'en') as string)
  const tr = (translations as any)[lang] || translations['en']

  const vehicleId = searchParams.get('vehicleId') || ''
  const vehicleName = searchParams.get('vehicleName') || ''
  const vehicleCategory = searchParams.get('vehicleCategory') || ''
  const vehicleSeats = searchParams.get('vehicleSeats') || ''
  const vehicleTransmission = searchParams.get('vehicleTransmission') || ''
  const vehicleYear = searchParams.get('vehicleYear') || ''
  const vehicleImage = searchParams.get('vehicleImage') || ''
  const pricePerDay = parseFloat(searchParams.get('pricePerDay') || '0')
  const urlCoupon = searchParams.get('coupon')?.toUpperCase() || ''
  const qrRef = searchParams.get('ref') || ''
  const partnerName = searchParams.get('partnerName') || ''
  const partnerDiscount = parseFloat(searchParams.get('partnerDiscount') || '0')
  const siteDomain = searchParams.get('siteDomain') || 'rent-cars.me'

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
    borderCrossing: 'no',  // default: staying in Montenegro
  })

  const [extras, setExtras] = useState<Extra[]>([])
  const [vehicleExtras, setVehicleExtras] = useState<VehicleExtra[]>([])
  const [dbLocations, setDbLocations] = useState<DBLocation[]>([])
  const [dbTransfers, setDbTransfers] = useState<DBTransfer[]>([])
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({})
  const [couponCode, setCouponCode] = useState(urlCoupon)
  const [couponData, setCouponData] = useState<{ discount_percent: number } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loggedInClient, setLoggedInClient] = useState<any>(null)

  const days = form.pickupDate && form.returnDate
    ? calculateDays(form.pickupDate, form.pickupTime, form.returnDate, form.returnTime)
    : parseInt(searchParams.get('days') || '1')

  // Auto-primijeni kupon ako je proslijeđen u URLu (npr. iz admin Dostupnost linka)
  useEffect(() => {
    if (urlCoupon) applyCoupon()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill form from logged-in client session
  useEffect(() => {
    function getCookie(name: string): string {
      if (typeof document === 'undefined') return ''
      const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
      return match ? decodeURIComponent(match[1]) : ''
    }
    const email = getCookie('avtorent-client-email')
    if (!email) return
    supabase.from('clients').select('*').eq('email', email).single().then(({ data }) => {
      if (!data) return
      setLoggedInClient(data)
      setForm(f => ({
        ...f,
        // Ime — spoji first+last ili full_name
        guestName: f.guestName || [data.first_name, data.last_name].filter(Boolean).join(' ') || data.full_name || '',
        guestEmail: f.guestEmail || data.email || '',
        // Telefon — provjeri sve moguće kolone
        guestPhone: f.guestPhone || data.phone || data.phone2 || '',
        // Nacionalnost
        guestNationality: f.guestNationality || data.nationality || '',
        // Datum rođenja
        guestDob: f.guestDob || data.date_of_birth || '',
        // Vozačka
        guestLicense: f.guestLicense || data.licence_number || data.licence_number_old || '',
      }))
    })
  }, [])

  // Auto-popuni podatke za ulogovanog klijenta
  useEffect(() => {
    function getCookie(name: string): string {
      if (typeof document === 'undefined') return ''
      const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
      return match ? decodeURIComponent(match[1]) : ''
    }
    const email = getCookie('avtorent-client-email')
    if (!email) return
    supabase.from('clients').select('*').eq('email', email).single()
      .then(({ data: c }) => {
        if (!c) return
        setForm(f => ({
          ...f,
          guestEmail: email,
          guestName: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.full_name || f.guestName,
          guestPhone: c.phone || f.guestPhone,
          guestNationality: c.nationality || f.guestNationality,
          guestDob: c.date_of_birth || f.guestDob,
          guestLicense: c.licence_number || f.guestLicense,
        }))
      })
  }, [])

  // Auto-detekcija zemlje po IP adresi → pre-popuni nacionalnost + telefon prefiks
  useEffect(() => {
    // Mapa ISO kod → naziv zemlje u našoj listi
    const ISO_TO_NAME: Record<string, string> = {
      'ME': 'Montenegro', 'RS': 'Serbia', 'BA': 'Bosnia and Herzegovina',
      'HR': 'Croatia', 'SI': 'Slovenia', 'MK': 'North Macedonia',
      'AL': 'Albania', 'DE': 'Germany', 'AT': 'Austria', 'CH': 'Switzerland',
      'IT': 'Italy', 'FR': 'France', 'GB': 'UK', 'US': 'USA',
      'RU': 'Russia', 'TR': 'Turkey', 'AE': 'UAE',
    }
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        const countryName = ISO_TO_NAME[d.country_code]
        if (!countryName) return
        const dial = DIAL_CODES[countryName] || ''
        setForm(f => {
          // Ne prebrisuj ako je korisnik već ulogovan/popunio
          const natEmpty = !f.guestNationality
          const phoneEmpty = !f.guestPhone.trim() || /^\+\d{1,4}\s*$/.test(f.guestPhone.trim())
          return {
            ...f,
            guestNationality: natEmpty ? countryName : f.guestNationality,
            guestPhone: (natEmpty && phoneEmpty && dial) ? dial + ' ' : f.guestPhone,
          }
        })
      })
      .catch(() => {}) // tiho ignoriši ako geo-IP ne radi
  }, [])

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
      if (!data || !data.is_active) { setCouponError('Invalid coupon.'); setCouponData(null) }
      else setCouponData(data)
    } catch { setCouponError('Error checking coupon.') }
    setCouponLoading(false)
  }

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!form.guestName.trim()) e.guestName = 'Required'
    if (!form.guestEmail.trim() || !form.guestEmail.includes('@')) e.guestEmail = 'Enter a valid email'
    if (!form.guestPhone.trim()) e.guestPhone = 'Required'
    if (!form.guestNationality) e.guestNationality = 'Required'
    if (!form.guestLicense.trim()) e.guestLicense = 'Required'
    setErrors(e); return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e: Record<string, string> = {}
    const today = new Date().toISOString().split('T')[0]
    if (!form.pickupDate) e.pickupDate = 'Required'
    else if (form.pickupDate < today) e.pickupDate = lang === 'de' ? 'Datum in der Vergangenheit' : lang === 'ru' ? 'Дата в прошлом' : 'Date cannot be in the past'
    if (!form.returnDate) e.returnDate = 'Required'
    const pickupLoc = form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation
    if (!pickupLoc?.trim()) e.pickupLocation = 'Select a location'
    if (form.pickupDate && form.returnDate && form.returnDate < form.pickupDate) e.returnDate = 'Return date cannot be before pickup'
    setErrors(e); return Object.keys(e).length === 0
  }

  function nextStep() {
    if (step === 1 && validateStep1()) setStep(2)
    else if (step === 2 && validateStep2()) setStep(3)
  }

  // Insurance label by lang
  function insLabel(ins: typeof INSURANCE_OPTIONS[0]): string {
    if (lang === 'de') return ins.labelDe
    if (lang === 'tr') return ins.labelTr
    if (lang === 'ru') return ins.labelRu
    if (lang === 'es') return ins.labelEs
    if (lang === 'fr') return ins.labelFr
    if (lang === 'ar') return ins.labelAr
    if (lang === 'en') return ins.labelEn
    return ins.label
  }

  function extraName(e: Extra): string {
    if (lang === 'en') return e.name_en || e.name
    if (lang === 'de') return e.name_de || e.name
    return e.name
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep1() || !validateStep2()) return
    setSubmitting(true)
    const resolvedPickup = form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation
    const resolvedDropoff = form.sameDropoff ? resolvedPickup : (form.dropoffLocation === '__custom' ? form.dropoffLocationCustom : form.dropoffLocation)
    const selectedExtrasList = filteredExtras.filter(ex => selectedExtras[ex.id]).map(ex => ({
      extraId: ex.id, extraName: extraName(ex),
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
          siteDomain: siteDomain || 'rent-cars.me',
          extrasTotal, basePrice: originalBasePrice, totalPrice: total,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert('Error submitting reservation. Please try again.'); setSubmitting(false); return }
      // Pass lang and hasLicense through to confirmation page
      router.push(`/vozila/potvrda?ref=${data.refCode}&lang=${lang}&partnerName=${encodeURIComponent(partnerName)}&partnerDiscount=${partnerDiscount}&isNewClient=${data.isNewClient ? 'true' : 'false'}&hasLicense=${data.hasLicense ? 'true' : 'false'}`)
    } catch { alert('Error. Please try again.'); setSubmitting(false) }
  }

  const inp = (err?: string): React.CSSProperties => ({ width: '100%', padding: '10px 12px', fontSize: 14, border: `1.5px solid ${err ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box', outline: 'none' })
  const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4, fontWeight: 500 }
  const errStyle: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 }
  const typeLabel = (e: Extra) => e.type === 'fixed' ? 'fixed' : `${getExtraPrice(e)}€ × ${days} days`

  // Labels by lang
  const L = {
    yourData: lang === 'de' ? 'Ihre Daten' : lang === 'tr' ? 'Bilgileriniz' : lang === 'ru' ? 'Ваши данные' : lang === 'es' ? 'Sus datos' : lang === 'fr' ? 'Vos données' : lang === 'ar' ? 'بياناتك' : 'Your details',
    period: lang === 'de' ? 'Mietzeit' : lang === 'ru' ? 'Период аренды' : lang === 'tr' ? 'Kiralama dönemi' : lang === 'ar' ? 'فترة الإيجار' : 'Rental period',
    review: lang === 'de' ? 'Überprüfung' : lang === 'ru' ? 'Обзор' : lang === 'tr' ? 'İnceleme' : lang === 'ar' ? 'مراجعة' : 'Review',
    fullName: lang === 'de' ? 'Vor- und Nachname' : lang === 'ru' ? 'Имя и фамилия' : lang === 'tr' ? 'Ad Soyad' : lang === 'ar' ? 'الاسم الكامل' : 'Full name',
    email: lang === 'de' ? 'E-Mail' : lang === 'ar' ? 'البريد الإلكتروني' : 'Email',
    phone: lang === 'de' ? 'Telefon' : lang === 'ru' ? 'Телефон' : lang === 'tr' ? 'Telefon' : lang === 'ar' ? 'الهاتف' : 'Phone',
    nationality: lang === 'de' ? 'Nationalität' : lang === 'ru' ? 'Национальность' : lang === 'tr' ? 'Uyruk' : lang === 'ar' ? 'الجنسية' : 'Nationality',
    dob: lang === 'de' ? 'Geburtsdatum' : lang === 'ru' ? 'Дата рождения' : lang === 'tr' ? 'Doğum tarihi' : lang === 'ar' ? 'تاريخ الميلاد' : 'Date of birth',
    license: lang === 'de' ? 'Führerscheinnummer' : lang === 'ru' ? 'Номер водительских прав' : lang === 'tr' ? 'Ehliyet numarası' : lang === 'ar' ? 'رقم رخصة القيادة' : 'Driving licence number',
    continue: lang === 'de' ? 'Weiter →' : lang === 'ru' ? 'Продолжить →' : lang === 'tr' ? 'Devam →' : lang === 'ar' ? 'متابعة →' : 'Continue →',
    confirm: lang === 'de' ? 'Buchung bestätigen' : lang === 'ru' ? 'Подтвердить бронирование' : lang === 'tr' ? 'Rezervasyonu onayla' : lang === 'ar' ? 'تأكيد الحجز' : 'Confirm booking',
    borderQ: lang === 'de' ? 'Fahren Sie über Montenegro hinaus?' : lang === 'ru' ? 'Планируете ли вы выехать за пределы Черногории?' : lang === 'tr' ? 'Karadağ dışına çıkacak mısınız?' : lang === 'ar' ? 'هل ستسافر خارج الجبل الأسود؟' : 'Will you travel outside Montenegro?',
    borderInfo: lang === 'de' ? 'Unser Agent wird Sie für die Details kontaktieren.' : lang === 'ru' ? 'Наш агент свяжется с вами для уточнения деталей.' : lang === 'tr' ? 'Acentemiz detaylar için sizinle iletişime geçecek.' : lang === 'ar' ? 'سيتواصل معك وكيلنا لمناقشة التفاصيل.' : 'Our agent will contact you to discuss the details.',
    yes: lang === 'de' ? 'Ja' : lang === 'ru' ? 'Да' : lang === 'tr' ? 'Evet' : lang === 'ar' ? 'نعم' : 'Yes',
    no: lang === 'de' ? 'Nein' : lang === 'ru' ? 'Нет' : lang === 'tr' ? 'Hayır' : lang === 'ar' ? 'لا' : 'No',
    insurance: lang === 'de' ? 'Versicherung' : lang === 'ru' ? 'Страхование' : lang === 'tr' ? 'Sigorta' : lang === 'ar' ? 'التأمين' : 'Insurance',
    extras: lang === 'de' ? 'Extras' : lang === 'ru' ? 'Дополнения' : lang === 'tr' ? 'Ekstralar' : lang === 'ar' ? 'إضافات' : 'Extras',
    total: lang === 'de' ? 'Gesamt' : lang === 'ru' ? 'Итого' : lang === 'tr' ? 'Toplam' : lang === 'ar' ? 'الإجمالي' : 'Total',
    deposit: lang === 'de' ? '+ Kaution 300€ (vor Ort)' : lang === 'ru' ? '+ Депозит 300€ (на месте)' : lang === 'tr' ? '+ Depozito 300€ (yerinde)' : lang === 'ar' ? '+ وديعة 300€ (في الموقع)' : '+ Deposit 300€ (on pickup)',
    back: lang === 'de' ? '← Zurück' : lang === 'ru' ? '← Назад' : lang === 'tr' ? '← Geri' : lang === 'ar' ? '← رجوع' : '← Back',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f6ff' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => step > 1 ? setStep(s => (s - 1) as 1|2|3) : router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', padding: '4px 8px' }}>←</button>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1a56a0' }}>ADRIA<span style={{ fontWeight: 300, color: '#4a90d9' }}>DRIVE</span></div>
          <div style={{ fontSize: 9, color: '#4a90d9', letterSpacing: 2 }}>BALKAN · RENT A CAR</div>
        </a>
        {loggedInClient && (
          <a href="/moje" style={{ marginLeft: 'auto', marginRight: 8, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', background: '#E6F1FB', borderRadius: 20, padding: '4px 12px 4px 6px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a56a0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              {((loggedInClient.first_name || loggedInClient.full_name || loggedInClient.email || '?')[0]).toUpperCase()}
            </div>
            <span style={{ fontSize: 11, color: '#185FA5', fontWeight: 600 }}>{loggedInClient.first_name || loggedInClient.full_name?.split(' ')[0] || 'Moj nalog'}</span>
          </a>
        )}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= s ? '#1a56a0' : '#e5e7eb', color: step >= s ? '#fff' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{s}</div>
              {s < 3 && <div style={{ width: 20, height: 2, background: step > s ? '#1a56a0' : '#e5e7eb' }} />}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
            {step === 1 ? L.yourData : step === 2 ? L.period : L.review}
          </div>
        </div>
      </nav>

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
              {vehicleTransmission && <span style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 20, padding: '2px 8px', color: '#6b7280' }}>⚙️ {vehicleTransmission === 'automatic' ? (lang === 'de' ? 'Automatik' : 'Automatic') : 'Manual'}</span>}
              {vehicleYear && <span style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 20, padding: '2px 8px', color: '#6b7280' }}>{vehicleYear}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {partnerDiscount > 0 && <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>{pricePerDay}€/dan</span>}
              <span style={{ color: '#1a56a0', fontWeight: 800, fontSize: 16 }}>{Math.round(pricePerDay * (1 - partnerDiscount / 100) * 100) / 100}€<span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>/day</span></span>
              {days > 0 && <span style={{ fontSize: 11, color: '#6b7280' }}>· {days} days = <strong style={{ color: '#1a56a0' }}>{basePrice.toFixed(2)}€</strong></span>}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* KORAK 1 */}
          {step === 1 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: loggedInClient ? 10 : 20 }}>👤 {L.yourData}</div>
              {loggedInClient && (
                <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#085041' }}>✅ {lang === 'de' ? 'Angemeldet als' : lang === 'ru' ? 'Вы вошли как' : 'Logged in as'}: {loggedInClient.first_name || loggedInClient.full_name || loggedInClient.email}</div>
                    <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{lang === 'de' ? 'Ihre Daten wurden automatisch ausgefüllt.' : lang === 'ru' ? 'Ваши данные заполнены автоматически.' : 'Your details have been pre-filled.'}</div>
                  </div>
                  <a href="/moje" style={{ fontSize: 11, color: '#085041', textDecoration: 'none', fontWeight: 600 }}>Moj nalog →</a>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>{L.fullName} *</label>
                  <input style={inp(errors.guestName)} value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} placeholder="John Smith" />
                  {errors.guestName && <div style={errStyle}>{errors.guestName}</div>}
                </div>
                <div>
                  <label style={lbl}>{L.email} *</label>
                  <input type="email" style={inp(errors.guestEmail)} value={form.guestEmail} onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))} placeholder="john@email.com" />
                  {errors.guestEmail && <div style={errStyle}>{errors.guestEmail}</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>{L.phone} *</label>
                  <input style={inp(errors.guestPhone)} value={form.guestPhone} onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} placeholder="+1 555 000 000" />
                  {errors.guestPhone && <div style={errStyle}>{errors.guestPhone}</div>}
                </div>
                <div>
                  <label style={lbl}>{L.dob}</label>
                  <input type="date" style={inp()} value={form.guestDob} onChange={e => setForm(f => ({ ...f, guestDob: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={lbl}>{L.nationality} *</label>
                  <select style={inp(errors.guestNationality)} value={form.guestNationality} onChange={e => {
                    const nat = e.target.value
                    const dial = DIAL_CODES[nat] || ''
                    setForm(f => {
                      // Pre-popuni prefiks telefona samo ako je prazan ili sadrži samo prefiks
                      const phoneEmpty = !f.guestPhone.trim() || /^\+\d{1,4}\s*$/.test(f.guestPhone.trim())
                      return { ...f, guestNationality: nat, guestPhone: phoneEmpty && dial ? dial + ' ' : f.guestPhone }
                    })
                  }}>
                    <option value="">-- Select --</option>
                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {errors.guestNationality && <div style={errStyle}>{errors.guestNationality}</div>}
                </div>
                <div>
                  <label style={lbl}>{L.license} *</label>
                  <input style={inp(errors.guestLicense)} value={form.guestLicense} onChange={e => setForm(f => ({ ...f, guestLicense: e.target.value }))} placeholder="e.g. D12345678" />
                  {errors.guestLicense && <div style={errStyle}>{errors.guestLicense}</div>}
                </div>
              </div>
              {/* Drugi vozač */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.hasSecondDriver ? 14 : 0 }}>
                  <input type="checkbox" checked={form.hasSecondDriver} onChange={e => setForm(f => ({ ...f, hasSecondDriver: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#1a56a0' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{lang === 'de' ? 'Zweiten Fahrer hinzufügen' : lang === 'ru' ? 'Добавить второго водителя' : lang === 'tr' ? 'İkinci sürücü ekle' : 'Add a second driver'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{lang === 'en' ? 'Optional — in case of driver change during rental' : 'Optional'}</div>
                  </div>
                </label>
                {form.hasSecondDriver && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={lbl}>Name</label><input style={inp()} value={form.driver2Name} onChange={e => setForm(f => ({ ...f, driver2Name: e.target.value }))} /></div>
                    <div><label style={lbl}>Licence no.</label><input style={inp()} value={form.driver2License} onChange={e => setForm(f => ({ ...f, driver2License: e.target.value }))} /></div>
                    <div>
                      <label style={lbl}>Nationality</label>
                      <select style={inp()} value={form.driver2Nationality} onChange={e => setForm(f => ({ ...f, driver2Nationality: e.target.value }))}>
                        <option value="">-- Select --</option>
                        {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" onClick={nextStep} style={{ width: '100%', padding: 13, background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {L.continue}
              </button>
            </div>
          )}

          {/* KORAK 2 */}
          {step === 2 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 20 }}>📅 {L.period}</div>

              {/* Datumi */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={lbl}>{tr.pickupDate} *</label>
                    <input type="date" style={inp(errors.pickupDate)} value={form.pickupDate} min={new Date().toISOString().split('T')[0]} onChange={e => setForm(f => ({ ...f, pickupDate: e.target.value }))} />
                    {errors.pickupDate && <div style={errStyle}>{errors.pickupDate}</div>}
                  </div>
                  <div>
                    <label style={lbl}>{tr.pickupTime}</label>
                    <input type="time" style={inp()} value={form.pickupTime} onChange={e => setForm(f => ({ ...f, pickupTime: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>{tr.returnDate} *</label>
                    <input type="date" style={inp(errors.returnDate)} value={form.returnDate} min={form.pickupDate || new Date().toISOString().split('T')[0]} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} />
                    {errors.returnDate && <div style={errStyle}>{errors.returnDate}</div>}
                  </div>
                  <div>
                    <label style={lbl}>{tr.returnTime}</label>
                    <input type="time" style={inp()} value={form.returnTime} onChange={e => setForm(f => ({ ...f, returnTime: e.target.value }))} />
                  </div>
                </div>
                {days > 0 && (
                  <div style={{ background: '#dbeafe', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1e40af', fontWeight: 500 }}>
                    📅 {tr.duration}: <strong>{days} {lang === 'en' ? (days === 1 ? 'day' : 'days') : lang === 'de' ? (days === 1 ? 'Tag' : 'Tage') : lang === 'ru' ? 'дн.' : lang === 'tr' ? 'gün' : lang === 'fr' ? (days === 1 ? 'jour' : 'jours') : lang === 'es' ? (days === 1 ? 'día' : 'días') : lang === 'ar' ? 'يوم' : (days === 1 ? 'dan' : 'dana')}</strong> · <strong>{basePrice.toFixed(2)}€</strong>
                  </div>
                )}
              </div>

              {/* Lokacije */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>📍 {lang === 'de' ? 'Standorte' : lang === 'ru' ? 'Места' : 'Locations'}</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>{tr.pickupLoc} *</label>
                  <select style={inp(errors.pickupLocation)} value={form.pickupLocation} onChange={e => setForm(f => ({ ...f, pickupLocation: e.target.value }))}>
                    <option value="">-- Select location --</option>
                    {dbLocations.map(l => <option key={l.id} value={l.name}>{l.name} ({l.country})</option>)}
                    <option value="__custom">{lang === 'de' ? 'Andere Adresse...' : lang === 'ru' ? 'Другой адрес...' : 'Other address...'}</option>
                  </select>
                  {form.pickupLocation === '__custom' && (
                    <input style={{ ...inp(errors.pickupLocation), marginTop: 6 }} value={form.pickupLocationCustom} onChange={e => setForm(f => ({ ...f, pickupLocationCustom: e.target.value }))} placeholder={lang === 'de' ? 'Adresse eingeben...' : 'Enter address...'} />
                  )}
                  {errors.pickupLocation && <div style={errStyle}>{errors.pickupLocation}</div>}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={form.sameDropoff} onChange={e => setForm(f => ({ ...f, sameDropoff: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#1a56a0' }} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{lang === 'de' ? 'Fahrzeug am selben Ort zurückgeben' : lang === 'ru' ? 'Вернуть в том же месте' : 'Return vehicle to same location'}</span>
                </label>

                {!form.sameDropoff && (
                  <div>
                    <label style={lbl}>{lang === 'de' ? 'Rückgabeort' : lang === 'ru' ? 'Место возврата' : 'Return location'}</label>
                    <select style={inp()} value={form.dropoffLocation} onChange={e => {
                      const dropoff = e.target.value
                      const fee = calcTransferFee(form.pickupLocation, dropoff)
                      setForm(f => ({ ...f, dropoffLocation: dropoff, transferFee: fee }))
                    }}>
                      <option value="">-- Select location --</option>
                      {dbLocations.map(l => <option key={l.id} value={l.name}>{l.name} ({l.country})</option>)}
                      <option value="__custom">{lang === 'de' ? 'Andere Adresse...' : 'Other address...'}</option>
                    </select>
                    {form.dropoffLocation === '__custom' && (
                      <input style={{ ...inp(), marginTop: 6 }} value={form.dropoffLocationCustom} onChange={e => setForm(f => ({ ...f, dropoffLocationCustom: e.target.value }))} placeholder="Enter address..." />
                    )}
                    {form.transferFee > 0 && (
                      <div style={{ fontSize: 12, color: '#085041', background: '#E1F5EE', padding: '5px 10px', borderRadius: 6, marginTop: 4 }}>
                        {lang === 'de' ? 'Transfergebühr' : lang === 'ru' ? 'Трансфер' : 'Transfer fee'}: <strong>{form.transferFee}€</strong>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 10 }}>
                  <label style={lbl}>{lang === 'de' ? 'Flugnummer (optional)' : lang === 'ru' ? 'Номер рейса (необязательно)' : 'Flight number (optional)'}</label>
                  <input style={inp()} value={form.flightNumber} onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value }))} placeholder="e.g. FR1234" />
                </div>
              </div>

              {/* Border crossing — info only, no charge */}
              <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>🌍 {L.borderQ}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {([['yes', `✅ ${L.yes}`], ['no', `🚫 ${L.no}`]] as [string, string][]).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setForm(f => ({ ...f, borderCrossing: val }))}
                      style={{ flex: 1, padding: '10px', fontSize: 13, border: `2px solid ${form.borderCrossing === val ? '#1a56a0' : '#e5e7eb'}`, borderRadius: 8, background: form.borderCrossing === val ? '#f0f6ff' : '#fff', color: form.borderCrossing === val ? '#1a56a0' : '#6b7280', cursor: 'pointer', fontWeight: form.borderCrossing === val ? 700 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.borderCrossing === 'yes' && (
                  <div style={{ background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#633806' }}>
                    ℹ️ {L.borderInfo}
                  </div>
                )}
              </div>

              {/* Osiguranje */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>🛡️ {L.insurance}</div>
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
                        {ins.price === 0 ? (lang === 'de' ? 'Inklusive' : lang === 'ru' ? 'Включено' : 'Included') : `+${ins.price}€/day`}
                        {ins.price > 0 && <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{ins.price * days}€ total</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dodaci */}
              {filteredExtras.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>🎒 {L.extras}</div>
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
                <label style={lbl}>{lang === 'de' ? 'Anmerkung (optional)' : lang === 'ru' ? 'Примечание (необязательно)' : 'Notes (optional)'}</label>
                <textarea style={{ ...inp(), minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={lang === 'en' ? 'Special requests, arrival info...' : lang === 'de' ? 'Sonderwünsche...' : ''} />
              </div>

              {/* Kupon */}
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>{lang === 'de' ? 'Gutscheincode (optional)' : lang === 'ru' ? 'Промокод (необязательно)' : 'Coupon code (optional)'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inp(), flex: 1 }} value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponData(null); setCouponError('') }} placeholder="COUPON123" />
                  <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} style={{ padding: '10px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}>
                    {couponLoading ? '...' : (lang === 'de' ? 'Anwenden' : lang === 'ru' ? 'Применить' : 'Apply')}
                  </button>
                </div>
                {couponError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{couponError}</div>}
                {couponData && <div style={{ fontSize: 12, color: '#1a56a0', marginTop: 4 }}>✓ {couponData.discount_percent}% {lang === 'de' ? 'Rabatt angewendet!' : lang === 'ru' ? 'скидка применена!' : 'discount applied!'}</div>}
              </div>

              <button type="button" onClick={nextStep} style={{ width: '100%', padding: 13, background: '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'de' ? 'Weiter zur Übersicht →' : lang === 'ru' ? 'Продолжить к обзору →' : 'Continue to review →'}
              </button>
            </div>
          )}

          {/* KORAK 3 */}
          {step === 3 && (
            <div>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 }}>✅ {L.review}</div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>👤 {L.yourData}</div>
                  {[[lang === 'en' ? 'Full name' : 'Name', form.guestName], ['Email', form.guestEmail], [lang === 'en' ? 'Phone' : 'Tel', form.guestPhone], [lang === 'en' ? 'Nationality' : 'Land', form.guestNationality], [lang === 'en' ? 'Licence no.' : 'Führerschein', form.guestLicense]].filter(([,v]) => v).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #f9fafb' }}>
                      <span style={{ color: '#6b7280' }}>{l}</span><span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>📅 {L.period}</div>
                  {[
                    [tr.pickupDate, `${form.pickupDate} ${form.pickupTime}`],
                    [tr.returnDate, `${form.returnDate} ${form.returnTime}`],
                    [tr.pickupLoc, form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation],
                    [lang === 'en' ? 'Return' : 'Rückgabe', form.sameDropoff ? (form.pickupLocation === '__custom' ? form.pickupLocationCustom : form.pickupLocation) : (form.dropoffLocation === '__custom' ? form.dropoffLocationCustom : form.dropoffLocation)],
                    [lang === 'en' ? 'Flight' : 'Flug', form.flightNumber],
                    [lang === 'en' ? 'Outside Montenegro' : 'Außerhalb', form.borderCrossing === 'yes' ? '✅ Yes' : 'No'],
                  ].filter(([,v]) => v).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #f9fafb' }}>
                      <span style={{ color: '#6b7280' }}>{l}</span><span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Obračun */}
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>💰 {L.total}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#6b7280' }}>
                    <span>{lang === 'en' ? 'Rental' : lang === 'de' ? 'Miete' : 'Rental'} ({days} {lang === 'en' ? 'days' : lang === 'de' ? 'Tage' : 'dana'} × {Math.round(pricePerDay * (1 - partnerDiscount / 100) * 100) / 100}€)</span>
                    <span>{basePrice.toFixed(2)}€</span>
                  </div>
                  {partnerDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#1a56a0' }}>
                      <span>🎁 {partnerName} ({partnerDiscount}%)</span><span>-{partnerDiscountAmount.toFixed(2)}€</span>
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
                      <span>🚗 Transfer</span><span>{form.transferFee}€</span>
                    </div>
                  )}
                  {couponData && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#1a56a0' }}>
                      <span>Coupon ({couponData.discount_percent}%)</span><span>-{couponDiscountAmount.toFixed(2)}€</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, padding: '12px 0 4px', marginTop: 8, borderTop: '2px solid #e5e7eb', color: '#111' }}>
                    <span>{L.total}</span><span style={{ color: '#1a56a0' }}>{total.toFixed(2)}€</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{L.deposit}</div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  {lang === 'de' ? 'Mit der Buchung bestätige ich:' : lang === 'ru' ? 'Отправляя бронирование, я подтверждаю:' : 'By confirming, I agree:'}
                </div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  <li>{lang === 'de' ? 'Ich akzeptiere die Mietbedingungen' : lang === 'ru' ? 'Я принимаю условия аренды' : 'I accept the rental terms and conditions'}</li>
                  <li>{lang === 'de' ? 'Meine Angaben entsprechen meinem Führerschein' : lang === 'ru' ? 'Мои данные соответствуют водительским правам' : 'My details match my driving licence'}</li>
                  <li>{lang === 'de' ? 'Kaution 300€ wird vor Ort bezahlt' : lang === 'ru' ? 'Депозит 300€ оплачивается при получении' : 'Deposit of 300€ is paid on pickup'}</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(2)} style={{ flex: 1, padding: 13, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{L.back}</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: 13, background: submitting ? '#4a90d9' : '#1a56a0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? '⏳...' : `🎉 ${L.confirm}`}
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
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading...</div>}>
      <BookingPageContent />
    </Suspense>
  )
}
