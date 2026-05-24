'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Client = {
  id: string; email: string; full_name: string; phone: string
  nationality: string; client_type: string; created_at: string
  licence_number: string | null; licence_country: string | null
  licence_expiry: string | null; licence_image_url: string | null
  date_of_birth: string | null; address: string | null
}

type Reservation = {
  id: string; ref_code: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string
  dropoff_location: string | null
  total_price: number; final_total: number | null
  status: string; inquiry_status: string | null; created_at: string
  assigned_vehicle_name: string | null
  insurance: string | null; insurance_total: number | null
  border_crossing: string | null; flight_number: string | null
  notes: string | null; extras_total: number | null
  transfer_fee: number | null; site_domain: string | null
  license_url: string | null
}

const DS = {
  primary: '#1a56a0', primaryDark: '#0e2d5e', primaryLight: '#E6F1FB',
  primaryAccent: '#378ADD', primaryMid: '#185FA5',
  textPrimary: '#111827', textSecondary: '#6b7280', textMuted: '#9ca3af',
  border: '#e5e7eb', borderBlue: '#c5d9f5',
  bgPage: '#f9fafb', bgCard: '#ffffff', bgSubtle: '#f3f4f6',
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: '⏳ Na čekanju' },
  confirmed: { bg: DS.primaryLight, color: DS.primaryMid, label: '✅ Potvrđeno' },
  issued:    { bg: '#E1F5EE', color: '#085041', label: '🚗 Izdato' },
  completed: { bg: '#EAF3DE', color: '#27500A', label: '✓ Završeno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: '✕ Otkazano' },
}

const INQ: Record<string, string> = {
  new: '🆕 Novi upit', reviewing: '👀 U pregledu',
  sent: '📨 Link poslan', confirmed: '✅ Potvrđeno', rejected: '❌ Odbijeno',
}

const inp = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: `1px solid ${DS.border}`, borderRadius: 8,
  color: DS.textPrimary, boxSizing: 'border-box' as const, background: DS.bgCard,
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function daysBetween(from: string, to: string): number {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000))
}

function ReservationCard({ r, onOpen }: { r: Reservation; onOpen: () => void }) {
  const st = ST[r.status] || ST.pending
  const today = new Date().toISOString().split('T')[0]
  const isActive = r.return_date >= today && (r.status === 'confirmed' || r.status === 'issued' || r.status === 'pending')
  const days = daysBetween(r.pickup_date, r.return_date)
  const total = r.final_total || r.total_price

  return (
    <div onClick={onOpen} style={{
      background: DS.bgCard, border: `1px solid ${isActive ? DS.borderBlue : DS.border}`,
      borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
      borderLeft: `4px solid ${isActive ? DS.primary : DS.border}`,
      transition: 'box-shadow 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: DS.textPrimary, marginBottom: 2 }}>
            🚗 {r.assigned_vehicle_name || 'Vozilo na čekanju'}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: DS.textMuted }}>{r.ref_code}</div>
        </div>
        <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
          {st.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        <div style={{ color: DS.textMuted }}>
          📅 Preuzimanje<br />
          <span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.pickup_date} u {r.pickup_time?.slice(0, 5) || '10:00'}</span>
        </div>
        <div style={{ color: DS.textMuted }}>
          📅 Vraćanje<br />
          <span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.return_date} u {r.return_time?.slice(0, 5) || '10:00'}</span>
        </div>
        <div style={{ color: DS.textMuted }}>
          📍 Lokacija<br />
          <span style={{ color: DS.textPrimary, fontWeight: 500 }}>{r.pickup_location}</span>
        </div>
        <div style={{ color: DS.textMuted }}>
          💰 Iznos<br />
          <span style={{ color: DS.primary, fontWeight: 700, fontSize: 15 }}>{total}€</span>
          <span style={{ color: DS.textMuted, fontSize: 10 }}> · {days} dana</span>
        </div>
      </div>

      {r.inquiry_status && r.inquiry_status !== 'confirmed' && r.status === 'pending' && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#633806', background: '#FAEEDA', padding: '4px 10px', borderRadius: 20, display: 'inline-block' }}>
          {INQ[r.inquiry_status] || r.inquiry_status}
        </div>
      )}
    </div>
  )
}

export default function ClientPortalPage() {
  const [client, setClient] = useState<Client | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'reservations' | 'feedback' | 'profile'>('reservations')
  const [selectedRez, setSelectedRez] = useState<Reservation | null>(null)
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', date_of_birth: '', address: '', licence_number: '', licence_country: '', licence_expiry: '' })
  const [profileSaving, setProfileSaving] = useState(false)

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
    setProfileForm({
      full_name: clientData.full_name || '', phone: clientData.phone || '',
      date_of_birth: clientData.date_of_birth || '', address: clientData.address || '',
      licence_number: clientData.licence_number || '', licence_country: clientData.licence_country || '',
      licence_expiry: clientData.licence_expiry || '',
    })

    // Čitaj iz reservations tabele direktno (bez vehicles join)
    const { data: res } = await supabase
      .from('reservations')
      .select('id, ref_code, pickup_date, return_date, pickup_time, return_time, pickup_location, dropoff_location, total_price, final_total, status, inquiry_status, created_at, assigned_vehicle_name, insurance, insurance_total, border_crossing, flight_number, notes, extras_total, transfer_fee, site_domain, license_url')
      .eq('guest_email', email)
      .order('created_at', { ascending: false })

    setReservations(res || [])
    setLoading(false)
  }

  async function saveProfile() {
    if (!client) return
    setProfileSaving(true)
    await supabase.from('clients').update({
      ...profileForm,
      date_of_birth: profileForm.date_of_birth || null,
      address: profileForm.address || null,
      licence_number: profileForm.licence_number || null,
      licence_country: profileForm.licence_country || null,
      licence_expiry: profileForm.licence_expiry || null,
    }).eq('id', client.id)
    setClient(c => c ? { ...c, ...profileForm } : null)
    setProfileSaving(false)
    setEditProfile(false)
  }

  async function sendFeedback() {
    if (!client || !feedbackComment.trim()) return
    setFeedbackSending(true)
    await supabase.from('client_feedback').insert({ client_id: client.id, rating: feedbackRating, comment: feedbackComment.trim() })
    setFeedbackSent(true)
    setFeedbackSending(false)
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DS.textMuted, background: DS.bgPage }}>
      Učitavanje...
    </div>
  )

  const tabStyle = (tab: string): React.CSSProperties => ({
    padding: '8px 18px', fontSize: 13, border: 'none',
    background: activeTab === tab ? DS.primary : 'transparent',
    color: activeTab === tab ? '#fff' : DS.textSecondary,
    cursor: 'pointer', borderRadius: 8,
    fontWeight: activeTab === tab ? 600 : 400,
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
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: DS.textMuted, cursor: 'pointer', textDecoration: 'underline' }}>
            Odjavi se
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 60px' }}>
        <div style={{ display: 'flex', gap: 4, background: DS.bgSubtle, borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          <button style={tabStyle('reservations')} onClick={() => setActiveTab('reservations')}>Moje rezervacije</button>
          <button style={tabStyle('feedback')} onClick={() => setActiveTab('feedback')}>Ocjena</button>
          <button style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>Profil</button>
        </div>

        {/* REZERVACIJE */}
        {activeTab === 'reservations' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedRez ? '1fr 340px' : '1fr', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, margin: 0 }}>Moje rezervacije</h2>
                <a href="/" style={{ padding: '8px 18px', background: DS.primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  + Nova
                </a>
              </div>

              {reservations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', border: `1px dashed ${DS.border}`, borderRadius: 12, color: DS.textMuted }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
                  <div style={{ fontSize: 15, marginBottom: 8, color: DS.textSecondary }}>Još nemate rezervacija</div>
                  <a href="/" style={{ color: DS.primary, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Rezervišite vozilo →</a>
                </div>
              ) : (
                <>
                  {active.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: DS.primary, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Aktuelne ({active.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                        {active.map(r => <ReservationCard key={r.id} r={r} onOpen={() => setSelectedRez(selectedRez?.id === r.id ? null : r)} />)}
                      </div>
                    </div>
                  )}
                  {past.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: DS.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Istorija ({past.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                        {past.map(r => <ReservationCard key={r.id} r={r} onOpen={() => setSelectedRez(selectedRez?.id === r.id ? null : r)} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail panel */}
            {selectedRez && (
              <div style={{ border: `1px solid ${DS.border}`, borderRadius: 12, background: DS.bgCard, alignSelf: 'start', position: 'sticky' as const, top: 16, maxHeight: '85vh', overflowY: 'auto' as const }}>
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${DS.bgSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, background: DS.bgCard }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedRez.assigned_vehicle_name || 'Vozilo na čekanju'}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: DS.textMuted }}>{selectedRez.ref_code}</div>
                  </div>
                  <button onClick={() => setSelectedRez(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: DS.textMuted }}>✕</button>
                </div>

                <div style={{ padding: '14px 16px' }}>
                  {[
                    ['Status', (ST[selectedRez.status] || ST.pending).label],
                    ['Preuzimanje', `${selectedRez.pickup_date} u ${selectedRez.pickup_time?.slice(0, 5)}`],
                    ['Vraćanje', `${selectedRez.return_date} u ${selectedRez.return_time?.slice(0, 5)}`],
                    ['Lokacija', selectedRez.pickup_location],
                    ['Vraćanje lokacija', selectedRez.dropoff_location || selectedRez.pickup_location],
                    ['Osiguranje', selectedRez.insurance ? selectedRez.insurance === 'basic' ? 'Osnovno (AO)' : selectedRez.insurance === 'kasko_full' ? 'Full Kasko' : 'Kasko sa učešćem' : null],
                    ['Van granice', selectedRez.border_crossing === 'allowed' ? '✅ Da' : selectedRez.border_crossing === 'forbidden' ? '🚫 Ne' : null],
                    ['Broj leta', selectedRez.flight_number],
                    ['Extras', selectedRez.extras_total ? `${selectedRez.extras_total}€` : null],
                    ['Transfer', selectedRez.transfer_fee ? `${selectedRez.transfer_fee}€` : null],
                    ['Napomena', selectedRez.notes],
                  ].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, borderBottom: `1px solid ${DS.bgSubtle}` }}>
                      <span style={{ color: DS.textMuted }}>{l}</span>
                      <span style={{ color: DS.textPrimary, fontWeight: 500, maxWidth: 180, textAlign: 'right' as const }}>{v}</span>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 4, fontSize: 15, fontWeight: 700, borderTop: `1px solid ${DS.border}` }}>
                    <span>Ukupno</span>
                    <span style={{ color: DS.primary }}>{selectedRez.final_total || selectedRez.total_price}€</span>
                  </div>

                  {/* Vozačka dozvola */}
                  {selectedRez.license_url && (
                    <div style={{ marginTop: 12, background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: DS.primaryMid, marginBottom: 6 }}>📎 Vozačka dozvola</div>
                      <a href={selectedRez.license_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: DS.primaryMid, textDecoration: 'none', fontWeight: 600 }}>
                        📄 Pogledaj dokument →
                      </a>
                    </div>
                  )}

                  {/* Pending napomena */}
                  {selectedRez.status === 'pending' && (
                    <div style={{ marginTop: 12, background: '#FAEEDA', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#633806' }}>
                      ⏳ Vaš upit je primljen. Naš agent će vas uskoro kontaktirati radi potvrde vozila i detalja.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEEDBACK */}
        {activeTab === 'feedback' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, marginBottom: 20 }}>Ocjena i feedback</h2>
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: DS.textPrimary, marginBottom: 4 }}>⭐ Google recenzija</div>
              <p style={{ fontSize: 13, color: DS.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
                Ako ste zadovoljni uslugom, molimo vas da nas ocijenite — to nam puno znači!
              </p>
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer"
                style={{ display: 'inline-block', padding: '10px 20px', background: '#4285F4', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Ostavite recenziju na Google →
              </a>
            </div>

            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: DS.textPrimary, marginBottom: 4 }}>💬 Privatni feedback</div>
              <div style={{ fontSize: 12, color: DS.textMuted, marginBottom: 16 }}>Vaše mišljenje vidimo samo mi</div>
              {feedbackSent ? (
                <div style={{ background: DS.primaryLight, border: `1px solid ${DS.borderBlue}`, borderRadius: 8, padding: '14px', fontSize: 13, color: DS.primaryMid, textAlign: 'center' as const }}>
                  Hvala na feedbacku! 🙏
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setFeedbackRating(n)} style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${feedbackRating >= n ? DS.borderBlue : DS.border}`, background: feedbackRating >= n ? DS.primaryLight : DS.bgCard, fontSize: 18, cursor: 'pointer' }}>
                        {feedbackRating >= n ? '⭐' : '☆'}
                      </button>
                    ))}
                  </div>
                  <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Šta vam se svidjelo? Šta možemo poboljšati?" style={{ ...inp, minHeight: 100, resize: 'vertical' as const, marginBottom: 12 }} />
                  <button onClick={sendFeedback} disabled={feedbackSending || !feedbackComment.trim()}
                    style={{ padding: '10px 20px', background: !feedbackComment.trim() ? DS.textMuted : DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !feedbackComment.trim() ? 'not-allowed' : 'pointer' }}>
                    {feedbackSending ? 'Slanje...' : 'Pošalji'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* PROFIL */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: DS.textPrimary, marginBottom: 20 }}>Moj profil</h2>
            <div style={{ background: DS.bgCard, border: `1px solid ${DS.border}`, borderRadius: 12, padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: DS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: DS.primary }}>
                  {(client?.full_name || client?.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: DS.textPrimary }}>{client?.full_name || '—'}</div>
                  <div style={{ fontSize: 13, color: DS.textMuted }}>{client?.email}</div>
                </div>
              </div>

              {editProfile ? (
                <>
                  {[
                    ['Ime i prezime', 'full_name', 'text', 'Marko Petrović'],
                    ['Telefon', 'phone', 'text', '+382 67 000 000'],
                    ['Datum rođenja', 'date_of_birth', 'date', ''],
                    ['Adresa', 'address', 'text', 'Ulica, grad'],
                    ['Broj vozačke', 'licence_number', 'text', '123456789'],
                    ['Zemlja vozačke', 'licence_country', 'text', 'Crna Gora'],
                    ['Istek vozačke', 'licence_expiry', 'date', ''],
                  ].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: DS.textSecondary, display: 'block', marginBottom: 4 }}>{label}</label>
                      <input type={type} style={inp} placeholder={placeholder}
                        value={(profileForm as any)[field]}
                        onChange={e => setProfileForm(f => ({ ...f, [field]: e.target.value }))} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={saveProfile} disabled={profileSaving}
                      style={{ flex: 1, padding: '9px', background: DS.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {profileSaving ? 'Snimanje...' : 'Sačuvaj'}
                    </button>
                    <button onClick={() => setEditProfile(false)}
                      style={{ flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${DS.border}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: DS.textSecondary }}>
                      Odustani
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {[
                    ['Telefon', client?.phone],
                    ['Nacionalnost', client?.nationality],
                    ['Broj vozačke', client?.licence_number],
                    ['Zemlja vozačke', client?.licence_country],
                    ['Član od', client?.created_at ? new Date(client.created_at).toLocaleDateString('sr-RS') : null],
                    ['Ukupno rezervacija', String(reservations.length)],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${DS.bgSubtle}`, fontSize: 13 }}>
                      <span style={{ color: DS.textMuted }}>{l}</span>
                      <span style={{ color: DS.textPrimary, fontWeight: 500 }}>{v || '—'}</span>
                    </div>
                  ))}
                  <button onClick={() => setEditProfile(true)}
                    style={{ marginTop: 16, padding: '9px 20px', border: `1px solid ${DS.border}`, borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: DS.textSecondary }}>
                    Uredi profil
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
