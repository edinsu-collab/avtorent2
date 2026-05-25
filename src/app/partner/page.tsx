'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Reservation = {
  id: string; ref_code: string; guest_name: string; guest_phone: string
  pickup_date: string; return_date: string; total_price: number
  commission_amount: number; partner_discount_amount: number
  status: string; created_at: string; ref_qr_label: string | null
  assigned_vehicle_name: string | null
}

type Payout = {
  id: string; amount: number; note: string; status: string
  created_at: string; confirmed_at: string | null
}

type PartnerQrCode = {
  id: string; qr_code: string; label: string; created_at: string
  scan_count?: number; conversion_count?: number
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  issued:    { bg: '#EDE9FE', color: '#4C1D95', label: 'Aktivno' },
  completed: { bg: '#E6F1FB', color: '#0C447C', label: 'Završeno' },
  closed:    { bg: '#E6F1FB', color: '#0C447C', label: 'Završeno' },
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
  const [qrCodes, setQrCodes] = useState<PartnerQrCode[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'qr' | 'info' | 'outdoor'>('overview')
  const [outdoorSlug, setOutdoorSlug] = useState<string | null>(null)

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://rent-cars.me'

  useEffect(() => {
    const pid = getCookie('avtorent-partner-id')
    const pname = getCookie('avtorent-partner-name')
    if (!pid) { window.location.href = '/partner/login'; return }
    setPartnerId(pid)
    setPartnerName(pname)
    fetchData(pid)
  }, [])

  async function fetchData(pid: string) {
    const [{ data: res }, { data: pay }, { data: sc }, { data: codes }, { data: outdoor }] = await Promise.all([
      // Bez vehicles join — koristimo assigned_vehicle_name
      supabase.from('reservations')
        .select('id, ref_code, guest_name, guest_phone, pickup_date, return_date, total_price, commission_amount, partner_discount_amount, status, created_at, ref_qr_label, assigned_vehicle_name')
        .eq('partner_id', pid)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      supabase.from('partner_payouts').select('*').eq('partner_id', pid).order('created_at', { ascending: false }),
      supabase.from('qr_scans').select('id', { count: 'exact' }).eq('partner_id', pid),
      supabase.from('partner_qr_codes').select('*').eq('partner_id', pid).order('created_at'),
      supabase.from('partner_outdoor_pages').select('*').eq('partner_id', pid).single(),
    ])
    setReservations(res || [])
    setPayouts(pay || [])
    setScans(sc?.length || 0)
    if (outdoor) setOutdoorSlug(outdoor.slug)

    if (codes && codes.length > 0) {
      const withStats = await Promise.all(codes.map(async (c) => {
        const { data: scanData } = await supabase.from('qr_scans').select('id', { count: 'exact' }).eq('qr_code', c.qr_code)
        const { data: convData } = await supabase.from('reservations').select('id', { count: 'exact' }).eq('ref_qr_code', c.qr_code).neq('status', 'cancelled')
        return { ...c, scan_count: scanData?.length || 0, conversion_count: convData?.length || 0 }
      }))
      setQrCodes(withStats)
    } else {
      setQrCodes([])
    }
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

  const totalCommission = reservations.filter(r => ['completed','issued','closed'].includes(r.status)).reduce((s, r) => s + (r.commission_amount || 0), 0)
  const totalDiscount = reservations.reduce((s, r) => s + (r.partner_discount_amount || 0), 0)
  const totalPaid = payouts.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0)
  const totalPending = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const remaining = totalCommission - totalPaid
  const conversions = reservations.length

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Učitavanje...</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>
          ADRIA<span style={{ color: '#1D9E75', fontWeight: 300 }}>DRIVE</span>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>partner portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{partnerName}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>Odjavi se</button>
        </div>
      </nav>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
          {[['overview', 'Pregled'], ['qr', `QR kodovi (${qrCodes.length})`], ['info', 'Moja stranica'], ['outdoor', 'Outdoor']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: activeTab === key ? 600 : 400, color: activeTab === key ? '#1D9E75' : '#6b7280', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === key ? '#1D9E75' : 'transparent'}`, cursor: 'pointer', marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Metrike */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 32 }}>
              {[
                { label: 'QR posjete', value: scans, sub: 'skeniranja', color: '#111' },
                { label: 'Rezervacije', value: conversions, sub: scans > 0 ? `${((conversions/scans)*100).toFixed(1)}% konverzija` : 'od vaših gostiju', color: '#111' },
                { label: 'Ukupna provizija', value: `${totalCommission.toFixed(2)}€`, sub: 'od završenih', color: '#1D9E75' },
                { label: 'Ušteda gostiju', value: `${totalDiscount.toFixed(2)}€`, sub: 'popust po preporuci', color: '#185FA5' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f3f4f6', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
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
                              <button onClick={() => confirmPayout(p.id)} disabled={confirming === p.id}
                                style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #5DCAA5', borderRadius: 6, background: '#E1F5EE', color: '#0F6E56', cursor: 'pointer', fontWeight: 500 }}>
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
                      {['Ref', 'Gost', 'Vozilo', 'Period', 'Iznos', 'Provizija', 'Ušteda', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map(r => {
                      const st = ST[r.status] || ST.pending
                      const isEarned = ['completed','issued','closed'].includes(r.status)
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#374151', fontSize: 12 }}>
                            {r.assigned_vehicle_name || <span style={{ color: '#9ca3af' }}>Na čekanju</span>}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
                            {r.pickup_date}<br/>{r.return_date}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111' }}>{r.total_price}€</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: isEarned ? '#1D9E75' : '#9ca3af' }}>
                            {r.commission_amount ? `${r.commission_amount.toFixed(2)}€` : '—'}
                            {!isEarned && r.commission_amount > 0 && <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>po završetku</div>}
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
          </>
        )}

        {activeTab === 'qr' && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 4 }}>Vaši QR kodovi</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
              Svaki kod možete koristiti za različiti kanal — poruku gostima, flajer u sobi, recepciju i sl.
            </div>
            {qrCodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: 13 }}>
                Nemate QR kodova. Kontaktirajte administratora.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {qrCodes.map(c => {
                  const qrUrl = `${siteUrl}/?ref=${c.qr_code}`
                  return (
                    <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{c.label}</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#854F0B', background: '#FAEEDA', padding: '2px 8px', borderRadius: 12, marginTop: 4, display: 'inline-block' }}>{c.qr_code}</div>
                        </div>
                      </div>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&format=png`} alt={c.label} style={{ width: 160, height: 160 }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, width: '100%' }}>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{c.scan_count}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>posjeta</div>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>{c.conversion_count}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>rezervacija</div>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>
                            {c.scan_count && c.scan_count > 0 ? `${(((c.conversion_count || 0) / c.scan_count) * 100).toFixed(0)}%` : '—'}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>konverzija</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}&format=png`}
                          download={`QR-${c.qr_code}.png`} target="_blank" rel="noreferrer"
                          style={{ flex: 1, padding: '8px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', fontSize: 12, cursor: 'pointer', color: '#085041', fontWeight: 500, textAlign: 'center' as const, textDecoration: 'none' }}>
                          Preuzmi PNG
                        </a>
                        <button onClick={() => {
                          const win = window.open('', '_blank')
                          if (!win) return
                          win.document.write(`<html><head><title>QR - ${c.qr_code}</title><style>body{font-family:Arial;text-align:center;padding:40px}.name{font-size:18px;font-weight:bold;margin-top:12px}.label{font-size:14px;color:#1D9E75}.url{font-size:11px;color:#999;margin-top:6px}</style></head><body><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&format=png" width="300" height="300" /><div class="name">${partnerName}</div><div class="label">${c.label}</div><div class="url">${qrUrl}</div><script>window.onload=function(){window.print()}<\/script></body></html>`)
                        }}
                          style={{ flex: 1, padding: '8px', border: '1px solid #185FA5', borderRadius: 8, background: '#E6F1FB', fontSize: 12, cursor: 'pointer', color: '#185FA5', fontWeight: 500 }}>
                          Štampaj
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 8 }}>Moja info stranica</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Uredite stranicu koju vaši gosti vide kada skeniraju QR kod.</div>
            <a href="/partner/info" style={{ display: 'inline-block', padding: '11px 28px', background: '#0e2d5e', color: '#fff', textDecoration: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
              Otvori editor
            </a>
          </div>
        )}

        {activeTab === 'outdoor' && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 4 }}>Outdoor Crna Gora</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>QR kod koji vodi na stranicu sa outdoor aktivnostima.</div>
            {outdoorSlug && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#0a1628', borderRadius: 12, padding: '16px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${siteUrl}/outdoor/${outdoorSlug}`)}&format=png`}
                  alt="Outdoor QR" style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 6 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Outdoor QR kod</div>
                  <a href={`${siteUrl}/outdoor/${outdoorSlug}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: '#5DCAA5', textDecoration: 'none', display: 'block', marginBottom: 10 }}>
                    {siteUrl}/outdoor/{outdoorSlug} ↗
                  </a>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${siteUrl}/outdoor/${outdoorSlug}`)}&format=png`}
                      download={`QR-outdoor-${outdoorSlug}.png`} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 14px', border: '1px solid #1D9E75', borderRadius: 6, background: 'rgba(29,158,117,0.15)', fontSize: 12, color: '#5DCAA5', fontWeight: 500, textDecoration: 'none' }}>
                      Preuzmi PNG
                    </a>
                    <button onClick={() => {
                      const url = `${siteUrl}/outdoor/${outdoorSlug}`
                      const win = window.open('', '_blank')
                      if (!win) return
                      win.document.write(`<html><head><title>QR - Outdoor</title><style>body{font-family:Arial;text-align:center;padding:40px;background:#0a1628;color:#fff}</style></head><body><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&format=png" width="300" height="300" /><div style="font-size:18px;font-weight:bold;margin-top:12px">Outdoor Crna Gora</div><div style="font-size:11px;color:#5DCAA5;margin-top:6px">${url}</div><script>window.onload=function(){window.print()}<\/script></body></html>`)
                    }}
                      style={{ padding: '6px 14px', border: '1px solid #185FA5', borderRadius: 6, background: 'rgba(74,144,217,0.15)', fontSize: 12, color: '#7ab8f5', fontWeight: 500, cursor: 'pointer' }}>
                      Štampaj
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!outdoorSlug && (
              <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', fontSize: 13 }}>
                Nemate outdoor stranicu. Kontaktirajte administratora.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
