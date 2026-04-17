'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Client = {
  id: string; email: string; full_name: string; phone: string
  nationality: string; client_type: string; created_at: string
}

type Reservation = {
  id: string; ref_code: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string
  total_price: number; status: string; created_at: string
  vehicles: { name: string; image_url: string | null } | null
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  completed: { bg: '#E6F1FB', color: '#0C447C', label: 'Završeno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function ClientPortalPage() {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'reservations' | 'feedback' | 'profile'>('reservations')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' })
  const [profileSaving, setProfileSaving] = useState(false)

  const GOOGLE_REVIEW_URL = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || '#'

  useEffect(() => {
    const email = getCookie('avtorent-client-email')
    if (!email) { window.location.href = '/moje/login'; return }
    fetchData(email)
  }, [])

  async function fetchData(email: string) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .single()

    if (!clientData) { window.location.href = '/moje/login'; return }

    setClient(clientData)
    setProfileForm({ full_name: clientData.full_name || '', phone: clientData.phone || '' })

    const { data: res } = await supabase
      .from('reservations')
      .select('*, vehicles(name, image_url)')
      .eq('guest_email', email)
      .order('created_at', { ascending: false })

    setReservations(res || [])
    setLoading(false)
  }

  async function saveProfile() {
    if (!client) return
    setProfileSaving(true)
    await supabase.from('clients').update({ full_name: profileForm.full_name, phone: profileForm.phone }).eq('id', client.id)
    setClient(c => c ? { ...c, ...profileForm } : null)
    setProfileSaving(false)
    setEditProfile(false)
  }

  async function sendFeedback() {
    if (!client || !feedbackComment.trim()) return
    setFeedbackSending(true)
    await supabase.from('client_feedback').insert({
      client_id: client.id,
      rating: feedbackRating,
      comment: feedbackComment.trim(),
    })
    setFeedbackSent(true)
    setFeedbackSending(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'avtorent-client-token=; path=/; max-age=0'
    document.cookie = 'avtorent-client-email=; path=/; max-age=0'
    window.location.href = '/'
  }

  const active = reservations.filter(r => r.status === 'confirmed' || r.status === 'pending')
  const past = reservations.filter(r => r.status === 'completed' || r.status === 'cancelled')

  const tabStyle = (tab: string) => ({
    padding: '8px 18px', fontSize: 13, border: 'none', background: activeTab === tab ? '#1D9E75' : 'transparent',
    color: activeTab === tab ? '#fff' : '#6b7280', cursor: 'pointer', borderRadius: 8, fontWeight: activeTab === tab ? 600 : 400,
  })

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Učitavanje...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, color: '#111', textDecoration: 'none' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{client?.full_name || client?.email}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>Odjavi se</button>
        </div>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          <button style={tabStyle('reservations')} onClick={() => setActiveTab('reservations')}>Moje rezervacije</button>
          <button style={tabStyle('feedback')} onClick={() => setActiveTab('feedback')}>Ocjena i feedback</button>
          <button style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>Moj profil</button>
        </div>

        {/* Rezervacije */}
        {activeTab === 'reservations' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111' }}>Moje rezervacije</h2>
              <a href="/" style={{ padding: '8px 18px', background: '#1D9E75', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                + Nova rezervacija
              </a>
            </div>

            {reservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed #e5e7eb', borderRadius: 12, color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🚗</div>
                <div style={{ fontSize: 15, marginBottom: 8, color: '#374151' }}>Još nemate rezervacija</div>
                <a href="/" style={{ color: '#1D9E75', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Rezervišite vozilo →</a>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Aktuelne</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {active.map(r => <ReservationCard key={r.id} r={r} />)}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Prošle</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {past.map(r => <ReservationCard key={r.id} r={r} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Feedback */}
        {activeTab === 'feedback' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 20 }}>Ocjena i feedback</h2>

            {/* Google recenzija */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⭐</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>Ocijenite nas na Google</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Vaša recenzija nam znači!</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
                Bili smo zadovoljstvo da vam pružimo uslugu. Ako ste zadovoljni, molimo vas da nas ocijenite na Google — to nam puno znači!
              </p>
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '10px 20px', background: '#4285F4', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Ostavite recenziju na Google →
              </a>
            </div>

            {/* Interni feedback */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111', marginBottom: 4 }}>Privatni feedback</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Vaše mišljenje vidimo samo mi</div>

              {feedbackSent ? (
                <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#085041', textAlign: 'center' }}>
                  Hvala na feedbacku! 🙏
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Ocjena</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setFeedbackRating(n)} style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${feedbackRating >= n ? '#1D9E75' : '#e5e7eb'}`, background: feedbackRating >= n ? '#E1F5EE' : '#fff', fontSize: 18, cursor: 'pointer' }}>
                          {feedbackRating >= n ? '⭐' : '☆'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Komentar</label>
                    <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} placeholder="Šta vam se svidjelo? Šta možemo poboljšati?" style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 100, resize: 'vertical', boxSizing: 'border-box' as const, color: '#111' }} />
                  </div>
                  <button onClick={sendFeedback} disabled={feedbackSending || !feedbackComment.trim()} style={{ padding: '10px 20px', background: !feedbackComment.trim() ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !feedbackComment.trim() ? 'not-allowed' : 'pointer' }}>
                    {feedbackSending ? 'Slanje...' : 'Pošalji feedback'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Profil */}
        {activeTab === 'profile' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111', marginBottom: 20 }}>Moj profil</h2>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#0F6E56' }}>
                  {(client?.full_name || client?.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{client?.full_name || '—'}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>{client?.email}</div>
                </div>
              </div>

              {editProfile ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ime i prezime</label>
                    <input style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Telefon</label>
                    <input style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="+382 67 000 000" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveProfile} disabled={profileSaving} style={{ flex: 1, padding: '9px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {profileSaving ? 'Snimanje...' : 'Sačuvaj'}
                    </button>
                    <button onClick={() => setEditProfile(false)} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                      Odustani
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {[['Telefon', client?.phone], ['Nacionalnost', client?.nationality], ['Član od', client?.created_at ? new Date(client.created_at).toLocaleDateString('sr-RS') : '—'], ['Broj rezervacija', String(reservations.length)]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span style={{ color: '#9ca3af' }}>{l}</span>
                      <span style={{ color: '#111', fontWeight: 500 }}>{v || '—'}</span>
                    </div>
                  ))}
                  <button onClick={() => setEditProfile(true)} style={{ marginTop: 16, padding: '9px 20px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
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

function ReservationCard({ r }: { r: any }) {
  const st = ST[r.status] || ST.pending
  const today = new Date().toISOString().split('T')[0]
  const isActive = r.return_date >= today && r.status === 'confirmed'

  return (
    <div style={{ background: '#fff', border: `1px solid ${isActive ? '#5DCAA5' : '#e5e7eb'}`, borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ width: 60, height: 60, borderRadius: 8, background: '#f3f4f6', overflow: 'hidden', flexShrink: 0 }}>
        {r.vehicles?.image_url ? (
          <img src={r.vehicles.image_url} alt={r.vehicles.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🚗</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{r.vehicles?.name || '—'}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{r.ref_code}</div>
          </div>
          <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <div style={{ color: '#9ca3af' }}>Preuzimanje<br/><span style={{ color: '#111', fontWeight: 500 }}>{r.pickup_date} u {r.pickup_time?.slice(0,5) || '10:00'}</span></div>
          <div style={{ color: '#9ca3af' }}>Vraćanje<br/><span style={{ color: '#111', fontWeight: 500 }}>{r.return_date} u {r.return_time?.slice(0,5) || '10:00'}</span></div>
          <div style={{ color: '#9ca3af' }}>Lokacija<br/><span style={{ color: '#111', fontWeight: 500 }}>{r.pickup_location}</span></div>
          <div style={{ color: '#9ca3af' }}>Iznos<br/><span style={{ color: '#1D9E75', fontWeight: 700, fontSize: 14 }}>{r.total_price}€</span></div>
        </div>
      </div>
    </div>
  )
}
