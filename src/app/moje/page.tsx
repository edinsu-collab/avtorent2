'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const UPLOAD_FOLDER = '1gFiCAgolZu9fAn5d-Ngmsx9qp3hWdIkN'

type Client = {
  id: string; email: string; full_name: string; phone: string
  nationality: string; client_type: string; created_at: string
  licence_number: string | null; licence_country: string | null
  licence_expiry: string | null; licence_image_url: string | null
  date_of_birth: string | null; address: string | null
  first_name: string | null; last_name: string | null
  jmbg: string | null;
  loyalty_tier: string | null; loyalty_total_spent: number | null; loyalty_reservations_count: number | null; id_card_number: string | null
  passport_number: string | null; phone2: string | null
}

type Reservation = {
  id: string; ref_code: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string
  dropoff_location: string | null; total_price: number; status: string
  created_at: string; assigned_vehicle_name: string | null
  license_url: string | null; license_deadline: string | null
  notes: string | null; insurance: string | null
  border_crossing: string | null; flight_number: string | null
  agent_note: string | null
  guest_name: string | null; guest_phone: string | null
  guest_nationality: string | null; guest_dob: string | null
  guest_license: string | null
}

const DS = {
  primary: '#1a56a0', primaryLight: '#E6F1FB', primaryAccent: '#378ADD',
  primaryMid: '#185FA5', textPrimary: '#111827', textSecondary: '#6b7280',
  textMuted: '#9ca3af', border: '#e5e7eb', borderBlue: '#c5d9f5',
  bgPage: '#f9fafb', bgCard: '#ffffff', bgSubtle: '#f3f4f6',
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: '⏳ Na čekanju' },
  confirmed: { bg: DS.primaryLight, color: DS.primaryMid, label: '✅ Potvrđeno' },
  issued:    { bg: '#E1F5EE', color: '#085041', label: '🚗 Aktivno' },
  completed: { bg: '#EAF3DE', color: '#27500A', label: '✓ Završeno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: '✕ Otkazano' },
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: `1px solid ${DS.border}`, borderRadius: 8,
  color: DS.textPrimary, boxSizing: 'border-box', background: DS.bgCard,
}
// Input sa zelenim/crvenim okvirom za obavezna polja
function inpReq(val: string | null | undefined): React.CSSProperties {
  const filled = !!(val && val.toString().trim())
  return {
    ...inp,
    border: filled ? '1.5px solid #1D9E75' : '1.5px solid #fca5a5',
    background: filled ? '#f0fdf8' : '#fff5f5',
  }
}
const lbl: React.CSSProperties = { fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4, fontWeight: 500 }

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function getDeadlineInfo(deadline: string | null) {
  if (!deadline) return { expired: false, urgent: false, label: '' }
  const now = new Date(); const dl = new Date(deadline)
  const expired = now > dl
  const minutesLeft = Math.round((dl.getTime() - now.getTime()) / 60000)
  if (expired) return { expired: true, urgent: true, label: 'Rok je istekao' }
  if (minutesLeft <= 60) return { expired: false, urgent: true, label: `Preostalo: ${minutesLeft} min` }
  return { expired: false, urgent: false, label: `Rok: ${Math.round(minutesLeft / 60)}h` }
}

const NATIONALITIES = [
  'Crna Gora', 'Srbija', 'Bosna i Hercegovina', 'Hrvatska', 'Slovenija',
  'Makedonija', 'Albanija', 'Njemačka', 'Austrija', 'Švicarska',
  'Italija', 'Francuska', 'UK', 'SAD', 'Rusija', 'Ostalo',
]

function isProfileComplete(pf: ProfileForm, hasLicenceImage: boolean, docType: 'id_card' | 'passport'): boolean {
  return !!(
    pf.first_name.trim() &&
    pf.last_name.trim() &&
    pf.phone.trim() &&
    pf.date_of_birth &&
    pf.nationality &&
    pf.address.trim() &&
    pf.licence_number.trim() &&
    pf.licence_country &&
    hasLicenceImage
  )
}

type ProfileForm = {
  first_name: string; last_name: string; phone: string; phone2: string
  date_of_birth: string; nationality: string; address: string
  jmbg: string; id_card_number: string; passport_number: string
  licence_number: string; licence_country: string; licence_expiry: string
}

const EMPTY_PROFILE: ProfileForm = {
  first_name: '', last_name: '', phone: '', phone2: '',
  date_of_birth: '', nationality: '', address: '',
  jmbg: '', id_card_number: '', passport_number: '',
  licence_number: '', licence_country: '', licence_expiry: '',
}

// ═══ LOYALTY HELPERS ═══
function getLoyaltyTier(spent: number): 'bronze' | 'silver' | 'gold' {
  if (spent >= 2000) return 'gold'
  if (spent >= 500) return 'silver'
  return 'bronze'
}

const TIER_CONFIG = {
  bronze: { label: '🥉 Bronze', color: '#92400e', bg: '#fef3c7', border: '#f59e0b', discount: 0, next: 500, nextTier: 'Silver' },
  silver: { label: '🥈 Silver', color: '#374151', bg: '#f3f4f6', border: '#9ca3af', discount: 5, next: 2000, nextTier: 'Gold' },
  gold:   { label: '🥇 Gold',   color: '#92400e', bg: '#fef9c3', border: '#eab308', discount: 10, next: null, nextTier: null },
}

function LoyaltyCard({ client, reservations }: { client: any, reservations: any[] }) {
  const spent = client.loyalty_total_spent || reservations.filter((r: any) => r.status === 'closed' || r.status === 'completed').reduce((sum: number, r: any) => sum + (r.total_price || 0), 0)
  const tier = getLoyaltyTier(spent)
  const cfg = TIER_CONFIG[tier]
  const nextAmount = cfg.next ? cfg.next - spent : 0
  const progress = cfg.next ? Math.min(100, (spent / cfg.next) * 100) : 100
  const completedRez = reservations.filter((r: any) => r.status === 'closed' || r.status === 'completed' || r.status === 'issued').length

  return (
    <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {completedRez} rezervacija · {spent.toFixed(0)}€ ukupno
          </div>
        </div>
        {cfg.discount > 0 && (
          <div style={{ background: cfg.border, color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
            -{cfg.discount}% popust
          </div>
        )}
      </div>

      {/* Progress bar */}
      {cfg.next && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
            <span>{spent.toFixed(0)}€</span>
            <span>do {cfg.nextTier}: još {Math.max(0, nextAmount).toFixed(0)}€</span>
            <span>{cfg.next}€</span>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.1)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: cfg.border, borderRadius: 10, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {/* Benefits */}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
        {[
          tier === 'bronze' && { text: '✓ Pristup portalu', active: true },
          tier !== 'bronze' && { text: `✓ ${cfg.discount}% na sve rezervacije`, active: true },
          tier === 'gold' && { text: '✓ Besplatna dostava', active: true },
          tier === 'gold' && { text: '✓ Prioritetna podrška', active: true },
          tier === 'bronze' && { text: '→ Silver: 5% popust od 500€', active: false },
          tier === 'silver' && { text: '→ Gold: 10% + besplatna dostava od 2000€', active: false },
        ].filter(Boolean).map((b: any, i) => (
          <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: b.active ? cfg.border : 'transparent', color: b.active ? '#fff' : '#9ca3af', border: b.active ? 'none' : '1px dashed #d1d5db' }}>
            {b.text}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ClientPortalPage() {
  const [client, setClient] = useState<Client | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'reservations' | 'feedback' | 'profile' | 'contact'>('reservations')

  const [confirmingRez, setConfirmingRez] = useState<Reservation | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)

  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE)
  const [licenceFile, setLicenceFile] = useState<File | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [docType, setDocType] = useState<'id_card' | 'passport'>('id_card')

  const GOOGLE_REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || '#'

  useEffect(() => {
    const email = getCookie('avtorent-client-email')
    if (!email) { window.location.href = '/moje/login'; return }
    fetchData(email)
  }, [])

  async function fetchData(email: string) {
    const { data: clientData } = await supabase.from('clients').select('*').eq('email', email).single()
    if (!clientData) { window.location.href = '/moje/login'; return }
    setClient(clientData)

    const { data: res } = await supabase.from('reservations')
      .select('id, ref_code, pickup_date, return_date, pickup_time, return_time, pickup_location, dropoff_location, total_price, status, created_at, assigned_vehicle_name, license_url, license_deadline, notes, insurance, border_crossing, flight_number, agent_note, guest_name, guest_phone, guest_nationality, guest_dob, guest_license')
      .eq('guest_email', email)
      .order('created_at', { ascending: false })
    setReservations(res || [])

    // Auto-popuni profil iz klijent podataka ili iz prve rezervacije
    const latestRes = res?.[0]
    const pf: ProfileForm = {
      first_name: clientData.first_name || clientData.full_name?.split(' ')[0] || latestRes?.guest_name?.split(' ')[0] || '',
      last_name: clientData.last_name || clientData.full_name?.split(' ').slice(1).join(' ') || latestRes?.guest_name?.split(' ').slice(1).join(' ') || '',
      phone: clientData.phone || latestRes?.guest_phone || '',
      phone2: clientData.phone2 || '',
      date_of_birth: clientData.date_of_birth || latestRes?.guest_dob || '',
      nationality: clientData.nationality || latestRes?.guest_nationality || '',
      address: clientData.address || '',
      jmbg: clientData.jmbg || '',
      id_card_number: clientData.id_card_number || '',
      passport_number: clientData.passport_number || '',
      licence_number: clientData.licence_number || latestRes?.guest_license || '',
      licence_country: clientData.licence_country || latestRes?.guest_nationality || '',
      licence_expiry: clientData.licence_expiry || '',
    }
    setProfileForm(pf)
    if (clientData.passport_number) setDocType('passport')

    // Auto-potvrdi rezervacije ako klijent već ima vozačku
    if (clientData.licence_image_url && res && res.length > 0) {
      const toConfirm = res.filter((r: any) =>
        (r.status === 'confirmed' || r.status === 'pending') && !r.license_url
      )
      for (const r of toConfirm) {
        await supabase.from('reservations').update({
          license_url: clientData.licence_image_url,
          status: 'confirmed',
        }).eq('id', r.id)
      }
      if (toConfirm.length > 0) {
        // Refresh reservations
        const { data: updated } = await supabase.from('reservations')
          .select('id, ref_code, pickup_date, return_date, pickup_time, return_time, pickup_location, dropoff_location, total_price, status, created_at, assigned_vehicle_name, license_url, license_deadline, notes, insurance, border_crossing, flight_number, agent_note, guest_name, guest_phone, guest_nationality, guest_dob, guest_license')
          .eq('guest_email', email)
          .order('created_at', { ascending: false })
        setReservations(updated || [])
      }
    }

    setLoading(false)
  }

  const pendingConfirmation = reservations.filter(r =>
    (r.status === 'confirmed' || r.status === 'pending') && !r.license_url
  )

  async function uploadLicense(file: File): Promise<string | null> {
    setUploading(true); setUploadStatus('⏳ Upload...')
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        try {
          const res = await fetch('/api/upload', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, contentType: file.type, name: `VOZACKA_${confirmingRez?.ref_code}_${Date.now()}`, folderId: UPLOAD_FOLDER })
          })
          const json = await res.json()
          setUploading(false)
          if (json.status === 'success') { setUploadStatus('✅ Uploadovano'); resolve(json.url) }
          else { setUploadStatus('❌ Greška'); resolve(null) }
        } catch { setUploading(false); setUploadStatus('❌ Greška'); resolve(null) }
      }
    })
  }

  async function handleConfirmReservation() {
    if (!confirmingRez || !client) return
    const licUrl = uploadedUrl || client.licence_image_url
    if (!licUrl) { alert('Molimo uploadujte vozačku dozvolu!'); return }
    setSubmitting(true)
    await supabase.from('reservations').update({ license_url: licUrl, status: 'confirmed' }).eq('id', confirmingRez.id)
    if (licUrl !== client.licence_image_url) {
      await supabase.from('clients').update({ licence_image_url: licUrl }).eq('id', client.id)
      setClient(c => c ? { ...c, licence_image_url: licUrl } : null)
    }
    setReservations(prev => prev.map(r => r.id === confirmingRez.id ? { ...r, license_url: licUrl, status: 'confirmed' } : r))
    setSubmitting(false); setSubmitDone(true)
    setTimeout(() => { setConfirmingRez(null); setSubmitDone(false); setUploadedUrl(''); setUploadStatus('') }, 2000)
  }

  async function uploadLicenceFile(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        try {
          setUploadProgress(30)
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64,
              contentType: file.type,
              name: `VOZACKA_PROFIL_${client?.id}_${Date.now()}`,
              folderId: UPLOAD_FOLDER,
            })
          })
          setUploadProgress(80)
          const json = await res.json()
          resolve(json.status === 'success' ? json.url : null)
        } catch { resolve(null) }
      }
      reader.onerror = () => resolve(null)
    })
  }

  async function saveProfile() {
    if (!client) return
    setProfileSaving(true)

    let licenceImageUrl = client.licence_image_url
    if (licenceFile) {
      setUploadProgress(10)
      const uploaded = await uploadLicenceFile(licenceFile)
      if (uploaded) {
        licenceImageUrl = uploaded
        setUploadProgress(100)
      } else {
        setUploadProgress(0)
        alert('Greška pri uploadu vozačke. Pokušajte ponovo.')
        setProfileSaving(false)
        return
      }
    }

    const fullName = `${profileForm.first_name} ${profileForm.last_name}`.trim()

    // Koristi server API route sa service role key umjesto anon key
    const updateRes = await fetch('/api/client-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: client.id,
        first_name: profileForm.first_name || null,
        last_name: profileForm.last_name || null,
        full_name: fullName || null,
        phone: profileForm.phone || null,
        phone2: profileForm.phone2 || null,
        date_of_birth: profileForm.date_of_birth || null,
        nationality: profileForm.nationality || null,
        address: profileForm.address || null,
        jmbg: profileForm.jmbg || null,
        id_card_number: docType === 'id_card' ? (profileForm.id_card_number || null) : null,
        passport_number: docType === 'passport' ? (profileForm.passport_number || null) : null,
        licence_number: profileForm.licence_number || null,
        licence_country: profileForm.licence_country || null,
        licence_expiry: profileForm.licence_expiry || null,
        licence_image_url: licenceImageUrl,
      })
    })
    const updateJson = await updateRes.json()
    if (!updateRes.ok || updateJson.error) {
      alert('Greška pri snimanju: ' + (updateJson.error || 'Nepoznata greška'))
      setProfileSaving(false)
      return
    }

    setClient(c => c ? { ...c, ...profileForm, full_name: fullName, licence_image_url: licenceImageUrl } : null)
    setProfileSaving(false)
    setProfileSaved(true)
    setLicenceFile(null)
    setUploadProgress(0)

    // Auto-potvrdi rezervacije ako je profil sad verifikovan
    const updatedForm = { ...profileForm }
    const nowVerified = isProfileComplete(updatedForm, !!licenceImageUrl, docType)
    if (nowVerified && licenceImageUrl) {
      const toConfirm = reservations.filter(r =>
        (r.status === 'confirmed' || r.status === 'pending') && !r.license_url
      )
      for (const r of toConfirm) {
        await fetch('/api/client-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id, // dummy — API prihvata bilo koji table
            _table: 'reservations',
            _id: r.id,
            license_url: licenceImageUrl,
            status: 'confirmed',
          })
        })
        // Fallback direktno
        await supabase.from('reservations').update({
          license_url: licenceImageUrl,
          status: 'confirmed',
        }).eq('id', r.id)
      }
      if (toConfirm.length > 0) {
        setReservations(prev => prev.map(r =>
          (r.status === 'confirmed' || r.status === 'pending') && !r.license_url
            ? { ...r, license_url: licenceImageUrl, status: 'confirmed' }
            : r
        ))
      }
    }

    setTimeout(() => setProfileSaved(false), 3000)
  }

  async function sendFeedback() {
    if (!client || !feedbackComment.trim()) return
    setFeedbackSending(true)
    await supabase.from('client_feedback').insert({ client_id: client.id, rating: feedbackRating, comment: feedbackComment.trim() })
    setFeedbackSent(true); setFeedbackSending(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'avtorent-client-token=; path=/; max-age=0'
    document.cookie = 'avtorent-client-email=; path=/; max-age=0'
    window.location.href = '/'
  }

  const active = reservations.filter(r => ['pending', 'confirmed', 'issued'].includes(r.status))
  const past = reservations.filter(r => ['completed', 'cancelled'].includes(r.status))

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.textMuted, background: DS.bgPage }}>Učitavanje...</div>
  )

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '8px 18px', fontSize: 13, border: 'none',
    background: activeTab === tab ? DS.primary : 'transparent',
    color: activeTab === tab ? '#fff' : DS.textSecondary,
    cursor: 'pointer', borderRadius: 8, fontWeight: activeTab === tab ? 600 : 400,
  })

  return (
    <div style={{ minHeight: '100vh', background: DS.bgPage, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <nav style={{ background: DS.bgCard, borderBottom: `1px solid ${DS.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, color: DS.textPrimary, textDecoration: 'none' }}>
          ADRIA<span style={{ color: DS.primaryAccent, fontWeight: 300 }}>DRIVE</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: DS.primary }}>
              {(client?.full_name || client?.email || '?')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: DS.textPrimary, fontWeight: 500 }}>{client?.full_name || client?.email}</span>
            {client && (() => {
              const spent = client.loyalty_total_spent || 0
              const tier = getLoyaltyTier(spent)
              return tier !== 'bronze' ? (
                <span style={{ fontSize: 10, background: tier === 'gold' ? '#fef9c3' : '#f3f4f6', color: tier === 'gold' ? '#92400e' : '#374151', padding: '2px 7px', borderRadius: 20, fontWeight: 700, border: `1px solid ${tier === 'gold' ? '#eab308' : '#9ca3af'}` }}>
                  {tier === 'gold' ? '🥇' : '🥈'}
                </span>
              ) : null
            })()}
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: DS.textMuted, cursor: 'pointer', textDecoration: 'underline' }}>Odjavi se</button>
        </div>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 60px' }}>

        {pendingConfirmation.length > 0 && activeTab === 'reservations' && (
          <div style={{ background: '#fff8e1', border: '2px solid #f59e0b', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 2 }}>⚠️ Imate {pendingConfirmation.length} rezervaciju/e koje čekaju potvrdu</div>
              <div style={{ fontSize: 12, color: '#78350f' }}>Molimo uploadujte vozačku dozvolu.</div>
            </div>
            <button onClick={() => setConfirmingRez(pendingConfirmation[0])}
              style={{ padding: '8px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              Potvrdi sada →
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, background: DS.bgSubtle, borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          <button style={tabStyle('reservations')} onClick={() => setActiveTab('reservations')}>
            Moje rezervacije {pendingConfirmation.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '0 6px', fontSize: 11, marginLeft: 4 }}>{pendingConfirmation.length}</span>}
          </button>
          <button style={tabStyle('feedback')} onClick={() => setActiveTab('feedback')}>Ocjena</button>
          <button style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>Profil</button>
          <button style={tabStyle('contact')} onClick={() => setActiveTab('contact')}>Kontakt</button>
        </div>

        {/* ═══ REZERVACIJE ═══ */}
        {activeTab === 'reservations' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, margin: 0 }}>Moje rezervacije</h2>
              <a href="/" style={{ padding: '8px 18px', background: DS.primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>+ Nova</a>
            </div>
            {client && <LoyaltyCard client={client} reservations={reservations} />}
            {reservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', border: `1px dashed ${DS.border}`, borderRadius: 12, color: DS.textMuted }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
                <a href="/" style={{ color: DS.primary, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Rezervišite vozilo →</a>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: DS.primary, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Aktuelne ({active.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                      {active.map(r => {
                        const st = ST[r.status] || ST.pending
                        const needsLicense = !r.license_url && (r.status === 'confirmed' || r.status === 'pending')
                        const dl = getDeadlineInfo(r.license_deadline)
                        return (
                          <div key={r.id} style={{ background: DS.bgCard, border: `2px solid ${needsLicense ? '#f59e0b' : DS.borderBlue}`, borderRadius: 12, padding: '16px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: DS.textPrimary }}>🚗 {r.assigned_vehicle_name || 'Vozilo na čekanju'}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: 11, color: DS.textMuted, marginTop: 2 }}>{r.ref_code}</div>
                              </div>
                              <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{st.label}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 10 }}>
                              <div style={{ color: DS.textMuted }}>📅 Preuzimanje<br /><span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.pickup_date} u {r.pickup_time?.slice(0,5)}</span></div>
                              <div style={{ color: DS.textMuted }}>📅 Vraćanje<br /><span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.return_date} u {r.return_time?.slice(0,5)}</span></div>
                              <div style={{ color: DS.textMuted }}>📍 Lokacija<br /><span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.pickup_location}</span></div>
                              <div style={{ color: DS.textMuted }}>💰 Iznos<br /><span style={{ color: DS.primary, fontWeight: 700, fontSize: 15 }}>{r.total_price}€</span></div>
                            </div>
                            {needsLicense ? (
                              <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                                  ⚠️ Potrebna vozačka dozvola
                                  {dl.label && <span style={{ marginLeft: 8, fontWeight: 400, color: dl.expired ? '#dc2626' : '#78350f' }}>· {dl.label}</span>}
                                </div>
                                <button onClick={() => { setConfirmingRez(r); setUploadedUrl(''); setUploadStatus('') }}
                                  style={{ padding: '7px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                  {client?.licence_image_url ? '✓ Potvrdi rezervaciju' : '📎 Uploaduj i potvrdi'}
                                </button>
                              </div>
                            ) : r.license_url ? (
                              <div style={{ fontSize: 11, color: '#085041', background: '#E1F5EE', padding: '5px 10px', borderRadius: 8, display: 'inline-block' }}>✅ Vozačka potvrđena</div>
                            ) : null}
                            {r.agent_note && <div style={{ marginTop: 8, fontSize: 12, color: DS.primaryMid, background: DS.primaryLight, padding: '6px 10px', borderRadius: 8 }}>💬 {r.agent_note}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Istorija ({past.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                      {past.map(r => {
                        const st = ST[r.status] || ST.pending
                        return (
                          <div key={r.id} style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '14px 18px', opacity: 0.8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: DS.textPrimary }}>{r.assigned_vehicle_name || '—'}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: 10, color: DS.textMuted }}>{r.ref_code}</div>
                              </div>
                              <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                            </div>
                            <div style={{ fontSize: 12, color: DS.textMuted }}>
                              {r.pickup_date} → {r.return_date} · {r.pickup_location} · <strong style={{ color: DS.primary }}>{r.total_price}€</strong>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ KONTAKT ═══ */}
        {activeTab === 'contact' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, marginBottom: 20 }}>Kontakt</h2>
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '24px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: DS.textPrimary, marginBottom: 16 }}>AdriaDrive</div>
              {[
                { icon: '📞', label: 'Phone', value: '+382 69 810 805', href: 'tel:+38269810805' },
                { icon: '💬', label: 'WhatsApp', value: '+382 69 810 805', href: 'https://wa.me/38269810805' },
                { icon: '✉️', label: 'Email', value: 'info@rent-cars.me', href: 'mailto:info@rent-cars.me' },
                { icon: '📍', label: 'Adresa', value: 'Bulevar Veljka Vlahovića 16, Podgorica', href: null },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${DS.bgSubtle}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: DS.textMuted }}>{item.label}</div>
                    {item.href
                      ? <a href={item.href} style={{ fontSize: 14, fontWeight: 500, color: DS.primary, textDecoration: 'none' }}>{item.value}</a>
                      : <div style={{ fontSize: 14, fontWeight: 500, color: DS.textPrimary }}>{item.value}</div>}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: '12px 14px', background: DS.primaryLight, borderRadius: 8, fontSize: 12, color: DS.primaryMid }}>
                Radno vrijeme: <strong>Pon–Ned 08:00–22:00</strong>
              </div>
            </div>
          </div>
        )}

      {/* ═══ FEEDBACK ═══ */}
        {activeTab === 'feedback' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, marginBottom: 20 }}>Ocjena i feedback</h2>
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>⭐ Google recenzija</div>
              <p style={{ fontSize: 13, color: DS.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>Ako ste zadovoljni, molimo ocijenite nas na Google!</p>
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer"
                style={{ display: 'inline-block', padding: '10px 20px', background: '#4285F4', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Ostavite recenziju →
              </a>
            </div>
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>💬 Privatni feedback</div>
              <div style={{ fontSize: 12, color: DS.textMuted, marginBottom: 16 }}>Vidimo samo mi</div>
              {feedbackSent ? (
                <div style={{ background: DS.primaryLight, borderRadius: 8, padding: 14, fontSize: 13, color: DS.primaryMid, textAlign: 'center' as const }}>Hvala! 🙏</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setFeedbackRating(n)} style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${feedbackRating >= n ? DS.borderBlue : DS.border}`, background: feedbackRating >= n ? DS.primaryLight : DS.bgCard, fontSize: 18, cursor: 'pointer' }}>
                        {feedbackRating >= n ? '⭐' : '☆'}
                      </button>
                    ))}
                  </div>
                  <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Vaše mišljenje..." style={{ ...inp, minHeight: 90, resize: 'vertical' as const, marginBottom: 10 }} />
                  <button onClick={sendFeedback} disabled={feedbackSending || !feedbackComment.trim()}
                    style={{ padding: '9px 20px', background: !feedbackComment.trim() ? DS.textMuted : DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {feedbackSending ? 'Slanje...' : 'Pošalji'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ PROFIL ═══ */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, marginBottom: 20 }}>Moj profil</h2>
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '24px' }}>

              {/* Avatar */}
              {(() => {
                const verified = isProfileComplete(profileForm, !!client?.licence_image_url, docType)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: DS.primary }}>
                      {(client?.full_name || client?.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: DS.textPrimary }}>{client?.full_name || '—'}</div>
                        {verified
                          ? <span style={{ fontSize: 11, background: '#E1F5EE', color: '#085041', border: '1px solid #1D9E75', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>✅ Verifikovan</span>
                          : <span style={{ fontSize: 11, background: '#fff8e1', color: '#92400e', border: '1px solid #f59e0b', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>⚠️ Nepotpun</span>
                        }
                      </div>
                      <div style={{ fontSize: 13, color: DS.textMuted }}>{client?.email}</div>
                    </div>
                  </div>
                )
              })()}

              {/* Vozačka status */}
              <div style={{ background: client?.licence_image_url ? '#E1F5EE' : '#fff8e1', border: `1px solid ${client?.licence_image_url ? '#1D9E75' : '#f59e0b'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: client?.licence_image_url ? '#085041' : '#92400e', marginBottom: client?.licence_image_url ? 4 : 0 }}>
                  {client?.licence_image_url ? '✅ Vozačka dozvola u dosijeu' : '⚠️ Vozačka dozvola nije uploadovana'}
                </div>
                {client?.licence_image_url && <a href={client.licence_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#085041', textDecoration: 'none' }}>📄 Pogledaj →</a>}
              </div>

              {profileSaved && (
                <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: '#085041', fontWeight: 600 }}>
                  ✅ Profil sačuvan!
                </div>
              )}

              {/* ── LIČNI PODACI ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${DS.border}` }}>Lični podaci</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Ime</label>
                  <input style={inpReq(profileForm.first_name)} value={profileForm.first_name} onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Marko" />
                </div>
                <div>
                  <label style={lbl}>Prezime</label>
                  <input style={inpReq(profileForm.last_name)} value={profileForm.last_name} onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Petrović" />
                </div>
                <div>
                  <label style={lbl}>Telefon 1</label>
                  <input style={inpReq(profileForm.phone)} value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67 000 000" />
                </div>
                <div>
                  <label style={lbl}>Telefon 2 (opciono)</label>
                  <input style={inp} value={profileForm.phone2} onChange={e => setProfileForm(f => ({ ...f, phone2: e.target.value }))} placeholder="+382 69 000 000" />
                </div>
                <div>
                  <label style={lbl}>Datum rođenja</label>
                  <input type="date" style={{...inp, border: profileForm.date_of_birth ? "1.5px solid #1D9E75" : "1.5px solid #fca5a5", background: profileForm.date_of_birth ? "#f0fdf8" : "#fff5f5"}} value={profileForm.date_of_birth} onChange={e => setProfileForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Zemlja / Nacionalnost</label>
                  <select style={inpReq(profileForm.nationality)} value={profileForm.nationality} onChange={e => setProfileForm(f => ({ ...f, nationality: e.target.value }))}>
                    <option value="">-- Odaberi --</option>
                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Adresa stanovanja</label>
                  <input style={inpReq(profileForm.address)} value={profileForm.address} onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))} placeholder="Ulica, grad" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>JMBG (opciono)</label>
                  <input style={inp} value={profileForm.jmbg} onChange={e => setProfileForm(f => ({ ...f, jmbg: e.target.value }))} placeholder="1234567890123" />
                </div>
              </div>

              {/* ── DOKUMENT ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${DS.border}` }}>Dokument identiteta</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button type="button" onClick={() => setDocType('id_card')}
                  style={{ flex: 1, padding: '8px', border: `2px solid ${docType === 'id_card' ? DS.primary : DS.border}`, borderRadius: 8, background: docType === 'id_card' ? DS.primaryLight : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: docType === 'id_card' ? 700 : 400, color: docType === 'id_card' ? DS.primary : DS.textSecondary }}>
                  🪪 Lična karta
                </button>
                <button type="button" onClick={() => setDocType('passport')}
                  style={{ flex: 1, padding: '8px', border: `2px solid ${docType === 'passport' ? DS.primary : DS.border}`, borderRadius: 8, background: docType === 'passport' ? DS.primaryLight : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: docType === 'passport' ? 700 : 400, color: docType === 'passport' ? DS.primary : DS.textSecondary }}>
                  📕 Pasoš
                </button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>{docType === 'id_card' ? 'Broj lične karte' : 'Broj pasoša'}</label>
                <input style={inp}
                  value={docType === 'id_card' ? profileForm.id_card_number : profileForm.passport_number}
                  onChange={e => docType === 'id_card'
                    ? setProfileForm(f => ({ ...f, id_card_number: e.target.value }))
                    : setProfileForm(f => ({ ...f, passport_number: e.target.value }))}
                  placeholder={docType === 'id_card' ? '123456789' : 'P1234567'} />
              </div>

              {/* ── VOZAČKA ── */}
              <div style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${DS.border}` }}>Vozačka dozvola</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>Broj vozačke</label>
                  <input style={inpReq(profileForm.licence_number)} value={profileForm.licence_number} onChange={e => setProfileForm(f => ({ ...f, licence_number: e.target.value }))} placeholder="001234567" />
                </div>
                <div>
                  <label style={lbl}>Zemlja izdavanja</label>
                  <select style={inpReq(profileForm.licence_country)} value={profileForm.licence_country} onChange={e => setProfileForm(f => ({ ...f, licence_country: e.target.value }))}>
                    <option value="">-- Odaberi --</option>
                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Datum isteka *</label>
                  <input type="date"
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      ...inp,
                      border: !profileForm.licence_expiry
                        ? '1.5px solid #fca5a5'
                        : new Date(profileForm.licence_expiry) < new Date()
                          ? '1.5px solid #dc2626'
                          : '1.5px solid #1D9E75',
                      background: !profileForm.licence_expiry
                        ? '#fff5f5'
                        : new Date(profileForm.licence_expiry) < new Date()
                          ? '#fef2f2'
                          : '#f0fdf8',
                    }}
                    value={profileForm.licence_expiry}
                    onChange={e => setProfileForm(f => ({ ...f, licence_expiry: e.target.value }))}
                  />
                  {profileForm.licence_expiry && new Date(profileForm.licence_expiry) < new Date() && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3, fontWeight: 600 }}>
                      ⚠️ Vozačka dozvola je istekla — unesite važeći datum isteka
                    </div>
                  )}
                </div>
              </div>

              {/* Upload vozačke */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ ...lbl, marginBottom: 6 }}>
                  Slika vozačke dozvole {client?.licence_image_url && <span style={{ color: '#085041' }}>✓ uploadovana</span>}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', border: `1px dashed ${licenceFile ? DS.primary : client?.licence_image_url ? '#1D9E75' : '#f59e0b'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, color: licenceFile ? DS.primary : client?.licence_image_url ? '#085041' : '#92400e', background: licenceFile ? DS.primaryLight : client?.licence_image_url ? '#f0fdf8' : '#fff8e1', fontWeight: 500 }}>
                  {licenceFile ? `📎 ${licenceFile.name}` : client?.licence_image_url ? '📷 Zamijeni vozačku' : '📷 Dodaj sliku vozačke'}
                  <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => { setLicenceFile(e.target.files?.[0] || null); setUploadProgress(0) }} />
                </label>
                {licenceFile && uploadProgress === 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: DS.primary, fontWeight: 500 }}>📎 Fajl odabran — klikni "Sačuvaj profil" za upload</div>
                )}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: DS.textMuted, marginBottom: 4 }}>
                      <span>⏳ Uploading...</span><span>{uploadProgress}%</span>
                    </div>
                    <div style={{ height: 6, background: DS.bgSubtle, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${uploadProgress}%`, background: DS.primary, borderRadius: 10, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )}
                {uploadProgress === 100 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#085041', fontWeight: 600 }}>✅ Vozačka uploadovana!</div>
                )}
                {client?.licence_image_url && !licenceFile && (
                  <a href={client.licence_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#085041', textDecoration: 'none', display: 'block', marginTop: 4 }}>📄 Pogledaj trenutnu vozačku →</a>
                )}
              </div>

              {/* Checklist šta fali */}
              {(() => {
                const checks = [
                  ['Ime', !!profileForm.first_name.trim()],
                  ['Prezime', !!profileForm.last_name.trim()],
                  ['Telefon', !!profileForm.phone.trim()],
                  ['Datum rođenja', !!profileForm.date_of_birth],
                  ['Nacionalnost', !!profileForm.nationality],
                  ['Adresa', !!profileForm.address.trim()],
                  ['Br. vozačke', !!profileForm.licence_number.trim()],
                  ['Zemlja vozačke', !!profileForm.licence_country],
                  ['Istek vozačke', !!(profileForm.licence_expiry && new Date(profileForm.licence_expiry) >= new Date())],
                  ['Slika vozačke', !!client?.licence_image_url],
                  ['Datum isteka vozačke', !!(profileForm.licence_expiry && new Date(profileForm.licence_expiry) >= new Date())],
                ]
                const done = checks.filter(([, v]) => v).length
                const total = checks.length
                const allDone = done === total
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: allDone ? '#085041' : DS.textMuted, fontWeight: 600 }}>
                        {allDone ? '✅ Profil potpun' : `Popunjenost profila: ${done}/${total}`}
                      </span>
                      <span style={{ color: allDone ? '#085041' : DS.primary, fontWeight: 700 }}>{Math.round(done/total*100)}%</span>
                    </div>
                    <div style={{ height: 6, background: DS.bgSubtle, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${Math.round(done/total*100)}%`, background: allDone ? '#1D9E75' : DS.primary, borderRadius: 10, transition: 'width 0.3s ease' }} />
                    </div>
                    {!allDone && (
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                        {checks.filter(([, v]) => !v).map(([label]) => (
                          <span key={label as string} style={{ fontSize: 10, background: '#fff8e1', color: '#92400e', border: '1px solid #f59e0b', padding: '2px 7px', borderRadius: 20 }}>
                            ⚠️ {label as string}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Sačuvaj */}
              <button onClick={saveProfile} disabled={profileSaving}
                style={{ width: '100%', padding: '11px', background: profileSaving ? '#5DCAA5' : DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {profileSaving ? '⏳ Snimanje...' : '💾 Sačuvaj profil'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL — Potvrda rezervacije */}
      {confirmingRez && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: DS.bgCard, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: '20px 20px 32px' }}>
            {submitDone ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#085041' }}>Rezervacija potvrđena!</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Potvrdi rezervaciju</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: DS.textMuted }}>{confirmingRez.ref_code}</div>
                  </div>
                  <button onClick={() => setConfirmingRez(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: DS.textMuted }}>✕</button>
                </div>
                <div style={{ background: DS.bgSubtle, borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12 }}>
                  <div>🚗 {confirmingRez.assigned_vehicle_name || 'Vozilo na čekanju'}</div>
                  <div style={{ color: DS.textMuted, marginTop: 4 }}>📅 {confirmingRez.pickup_date} → {confirmingRez.return_date} · 📍 {confirmingRez.pickup_location}</div>
                  <div style={{ fontWeight: 700, color: DS.primary, marginTop: 4 }}>{confirmingRez.total_price}€</div>
                </div>
                {confirmingRez.license_deadline && (() => {
                  const dl = getDeadlineInfo(confirmingRez.license_deadline)
                  return (
                    <div style={{ background: dl.expired ? '#FCEBEB' : '#fff8e1', border: `1px solid ${dl.expired ? '#fecaca' : '#f59e0b'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: dl.expired ? '#dc2626' : '#92400e', fontWeight: 600 }}>
                      {dl.expired ? '⛔ Rok istekao' : `⏰ ${dl.label}`}
                    </div>
                  )
                })()}
                {client?.licence_image_url ? (
                  <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#085041', marginBottom: 4 }}>✅ Vozačka dozvola već u dosijeu</div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>Koristimo vašu prethodno uploadovanu vozačku.</div>
                    <a href={client.licence_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#085041', textDecoration: 'none', fontWeight: 600 }}>📄 Pregledaj →</a>
                  </div>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: DS.textPrimary, marginBottom: 8 }}>📎 Uploadujte vozačku dozvolu</div>
                    {uploadedUrl && (
                      <div style={{ background: '#E1F5EE', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#085041', fontWeight: 600 }}>
                        ✅ Uploadovano — <a href={uploadedUrl} target="_blank" rel="noreferrer" style={{ color: '#085041' }}>Pregledaj →</a>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ flex: 1, padding: '11px', background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, textAlign: 'center' as const, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#085041' }}>
                        📷 Slikaj
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={uploading}
                          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const u = await uploadLicense(f); if (u) setUploadedUrl(u) }} />
                      </label>
                      <label style={{ flex: 1, padding: '11px', background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 10, textAlign: 'center' as const, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#085041' }}>
                        🖼️ Galerija
                        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={uploading}
                          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const u = await uploadLicense(f); if (u) setUploadedUrl(u) }} />
                      </label>
                    </div>
                    {uploadStatus && <div style={{ fontSize: 12, color: uploadStatus.includes('✅') ? '#1D9E75' : '#dc2626', marginTop: 6, fontWeight: 600 }}>{uploadStatus}</div>}
                  </div>
                )}
                <button onClick={handleConfirmReservation}
                  disabled={submitting || (!client?.licence_image_url && !uploadedUrl) || uploading}
                  style={{ width: '100%', padding: '14px', background: (submitting || (!client?.licence_image_url && !uploadedUrl)) ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  {submitting ? '⏳ Potvrđujem...' : (!client?.licence_image_url && !uploadedUrl) ? '⚠️ Uploadujte vozačku' : '✓ Potvrdi rezervaciju'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <footer style={{ background: '#0e2d5e', padding: '24px', textAlign: 'center' as const, marginTop: 40 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>ADRIA<span style={{ fontWeight: 300, color: '#7ab8f5' }}>DRIVE</span></div>
        <div style={{ fontSize: 10, color: '#4a90d9', letterSpacing: 3, marginTop: 4 }}>BALKAN · RENT A CAR</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
          <a href="tel:+38269810805" style={{ fontSize: 12, color: '#7ab8f5', textDecoration: 'none' }}>📞 +382 69 810 805</a>
          <a href="https://wa.me/38269810805" style={{ fontSize: 12, color: '#7ab8f5', textDecoration: 'none' }}>💬 WhatsApp</a>
          <a href="mailto:info@rent-cars.me" style={{ fontSize: 12, color: '#7ab8f5', textDecoration: 'none' }}>✉️ info@rent-cars.me</a>
        </div>
        <div style={{ fontSize: 11, color: '#4a90d9', marginTop: 8 }}>© 2025 AdriaDrive · rent-cars.me</div>
      </footer>
    </div>
  )
}
