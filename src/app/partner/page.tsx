'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Reservation = {
  id: string; ref_code: string; guest_name: string; guest_phone: string
  pickup_date: string; return_date: string; total_price: number
  commission_amount: number; partner_discount_amount: number
  status: string; created_at: string
  vehicles: { name: string } | null
}

type Payout = {
  id: string; amount: number; note: string; status: string
  created_at: string; confirmed_at: string | null
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  completed: { bg: '#E6F1FB', color: '#0C447C', label: 'Završeno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

export default function PartnerPortalPage() {
  const [partnerId, setPartnerId] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [scans, setScans] = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    const pid = getCookie('avtorent-partner-id')
    const pname = getCookie('avtorent-partner-name')
    if (!pid) { window.location.href = '/partner/login'; return }
    setPartnerId(pid)
    setPartnerName(pname)
    fetchData(pid)
  }, [])

  async function fetchData(pid: string) {
    const [{ data: res }, { data: pay }, { data: sc }] = await Promise.all([
      supabase.from('reservations').select('*, vehicles(name)').eq('partner_id', pid).neq('status', 'cancelled').order('created_at', { ascending: false }),
      supabase.from('partner_payouts').select('*').eq('partner_id', pid).order('created_at', { ascending: false }),
      supabase.from('qr_scans').select('id', { count: 'exact' }).eq('partner_id', pid),
    ])
    setReservations(res || [])
    setPayouts(pay || [])
    setScans(sc?.length || 0)
    setLoading(false)
  }

  async function confirmPayout(payoutId: string) {
    setConfirming(payoutId)
    await supabase.from('partner_payouts').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', payoutId)
    fetchData(partnerId)
    setConfirming(null)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    document.cookie = 'avtorent-partner-token=; path=/; max-age=0'
    document.cookie = 'avtorent-partner-id=; path=/; max-age=0'
    document.cookie = 'avtorent-partner-name=; path=/; max-age=0'
    window.location.href = '/partner/login'
  }

  const totalCommission = reservations.filter(r => r.status === 'completed').reduce((s, r) => s + (r.commission_amount || 0), 0)
  const totalDiscount = reservations.reduce((s, r) => s + (r.partner_discount_amount || 0), 0)
  const totalPaid = payouts.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0)
  const totalPending = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const remaining = totalCommission - totalPaid
  const conversions = reservations.length

  const metric = (color?: string) => ({ background: '#f3f4f6', borderRadius: 10, padding: '16px 18px' })

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
      Učitavanje...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>partner portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{partnerName}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>Odjavi se</button>
        </div>
      </nav>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 16px' }}>

        {/* Metrike */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 32 }}>
          <div style={metric()}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>QR posjete</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>{scans}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>skeniranja vašeg koda</div>
          </div>
          <div style={metric()}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Rezervacije</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>{conversions}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {scans > 0 ? `${((conversions / scans) * 100).toFixed(1)}% konverzija` : 'od vaših gostiju'}
            </div>
          </div>
          <div style={metric()}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ukupna provizija</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1D9E75' }}>{totalCommission.toFixed(2)}€</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>od završenih rezervacija</div>
          </div>
          <div style={metric()}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ušteda vaših gostiju</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#185FA5' }}>{totalDiscount.toFixed(2)}€</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>popust po vašoj preporuci</div>
          </div>
        </div>

        {/* Isplate */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Provizije i isplate</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Ukupno zarađeno</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{totalCommission.toFixed(2)}€</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Isplaćeno</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#374151' }}>{totalPaid.toFixed(2)}€</div>
            </div>
            <div style={{ background: remaining > 0 ? '#FAEEDA' : '#f9fafb', borderRadius: 8, padding: '12px 14px', border: remaining > 0 ? '1px solid #EF9F27' : 'none' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Preostalo za naplatu</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: remaining > 0 ? '#BA7517' : '#374151' }}>{remaining.toFixed(2)}€</div>
            </div>
          </div>

          {payouts.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10 }}>Istorija isplata</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Datum', 'Iznos', 'Napomena', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{new Date(p.created_at).toLocaleDateString('sr-RS')}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75' }}>{p.amount.toFixed(2)}€</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{p.note || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500, background: p.status === 'confirmed' ? '#E1F5EE' : '#FAEEDA', color: p.status === 'confirmed' ? '#085041' : '#633806' }}>
                          {p.status === 'confirmed' ? 'Potvrđeno' : 'Čeka potvrdu'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.status === 'pending' && (
                          <button
                            onClick={() => confirmPayout(p.id)}
                            disabled={confirming === p.id}
                            style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #5DCAA5', borderRadius: 6, background: '#E1F5EE', color: '#0F6E56', cursor: 'pointer', fontWeight: 500 }}
                          >
                            {confirming === p.id ? '...' : 'Potvrdi prijem'}
                          </button>
                        )}
                        {p.status === 'confirmed' && p.confirmed_at && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(p.confirmed_at).toLocaleDateString('sr-RS')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {payouts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: 13 }}>
              Još nema isplata. Kontaktirajte administratora za isplatu provizije.
            </div>
          )}
        </div>

        {/* Rezervacije */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Rezervacije vaših gostiju</div>
          {reservations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px', color: '#9ca3af', fontSize: 13 }}>
              Još nema rezervacija. Podijelite vaš QR kod sa gostima!
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Ref', 'Gost', 'Vozilo', 'Period', 'Iznos', 'Vaša provizija', 'Ušteda gosta', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservations.map(r => {
                  const st = ST[r.status] || ST.pending
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{r.vehicles?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{r.pickup_date}<br/>{r.return_date}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>{r.total_price}€</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: r.status === 'completed' ? '#1D9E75' : '#9ca3af' }}>
                        {r.commission_amount ? `${r.commission_amount.toFixed(2)}€` : '—'}
                        {r.status !== 'completed' && <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>po završetku</div>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#185FA5', fontWeight: 500 }}>
                        {r.partner_discount_amount ? `${r.partner_discount_amount.toFixed(2)}€` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
