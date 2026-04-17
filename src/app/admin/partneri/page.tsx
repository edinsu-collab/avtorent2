'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Partner = {
  id: string; name: string; contact_name: string; email: string
  portal_email: string; phone: string
  commission_percent: number; client_discount_percent: number
  qr_code: string; is_active: boolean
  reservation_count?: number; total_revenue?: number
  commission_earned?: number; commission_paid?: number; commission_remaining?: number
}

type Payout = {
  id: string; amount: number; note: string; status: string; created_at: string
}

const emptyForm = { name: '', contact_name: '', email: '', portal_email: '', phone: '', commission_percent: '10', client_discount_percent: '5', qr_code: '' }

export default function AdminPartneriPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editPartner, setEditPartner] = useState<Partner | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: partnersData } = await supabase.from('partners').select('*').order('created_at')
    const { data: reservations } = await supabase.from('reservations').select('partner_id, total_price, commission_amount, status').neq('status', 'cancelled')
    const { data: payoutsData } = await supabase.from('partner_payouts').select('partner_id, amount, status')

    const enriched = (partnersData || []).map(p => {
      const pRes = (reservations || []).filter(r => r.partner_id === p.id)
      const completed = pRes.filter(r => r.status === 'completed')
      const commissionEarned = completed.reduce((s: number, r: { commission_amount: number }) => s + (r.commission_amount || 0), 0)
      const commissionPaid = (payoutsData || []).filter(p2 => p2.partner_id === p.id && p2.status === 'confirmed').reduce((s: number, p2: { amount: number }) => s + p2.amount, 0)
      return { ...p, reservation_count: pRes.length, total_revenue: pRes.reduce((s: number, r: { total_price: number }) => s + (r.total_price || 0), 0), commission_earned: commissionEarned, commission_paid: commissionPaid, commission_remaining: commissionEarned - commissionPaid }
    })
    setPartners(enriched)
    setLoading(false)
  }

  async function fetchPayouts(partnerId: string) {
    const { data } = await supabase.from('partner_payouts').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false })
    setPayouts(data || [])
  }

  function openEdit(p: Partner) {
    setEditPartner(p)
    setForm({ name: p.name, contact_name: p.contact_name || '', email: p.email || '', portal_email: p.portal_email || '', phone: p.phone || '', commission_percent: String(p.commission_percent), client_discount_percent: String(p.client_discount_percent || '0'), qr_code: p.qr_code })
    setShowForm(true)
    setSelectedPartner(null)
  }

  function openPayouts(p: Partner) {
    setSelectedPartner(p)
    setShowForm(false)
    fetchPayouts(p.id)
    setPayoutAmount('')
    setPayoutNote('')
  }

  async function savePartner() {
    if (!form.name || !form.qr_code) return
    setSaving(true)
    const payload = { name: form.name, contact_name: form.contact_name, email: form.email, portal_email: form.portal_email, phone: form.phone, commission_percent: parseFloat(form.commission_percent), client_discount_percent: parseFloat(form.client_discount_percent || '0'), qr_code: form.qr_code }
    if (editPartner) { await supabase.from('partners').update(payload).eq('id', editPartner.id) }
    else { await supabase.from('partners').insert({ ...payload, is_active: true }) }
    setSaving(false); setShowForm(false); fetchData()
  }

  async function sendPayout() {
    if (!selectedPartner || !payoutAmount) return
    setPayoutSaving(true)
    await supabase.from('partner_payouts').insert({
      partner_id: selectedPartner.id,
      amount: parseFloat(payoutAmount),
      note: payoutNote,
      status: 'pending',
    })

    // Pošalji email notifikaciju partneru
    if (selectedPartner.portal_email || selectedPartner.email) {
      await fetch('/api/partner-payout-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerName: selectedPartner.name,
          partnerEmail: selectedPartner.portal_email || selectedPartner.email,
          amount: parseFloat(payoutAmount),
          note: payoutNote,
        }),
      }).catch(() => {})
    }

    setPayoutAmount('')
    setPayoutNote('')
    setPayoutSaving(false)
    fetchPayouts(selectedPartner.id)
    fetchData()
  }

  function exportCSV() {
    const rows = [['Partner', 'QR', 'Rezerv.', 'Promet', 'Provizija', 'Isplaćeno', 'Preostalo'], ...partners.map(p => [p.name, p.qr_code, p.reservation_count, `${p.total_revenue?.toFixed(2)}EUR`, `${p.commission_earned?.toFixed(2)}EUR`, `${p.commission_paid?.toFixed(2)}EUR`, `${p.commission_remaining?.toFixed(2)}EUR`])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `provizije_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Partneri</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Izvoz CSV</button>
          <button onClick={() => { setEditPartner(null); setForm({ ...emptyForm, qr_code: `AP-${String(Date.now()).slice(-4)}` }); setShowForm(true); setSelectedPartner(null) }} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Dodaj partnera</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: (showForm || selectedPartner) ? '1fr 340px' : '1fr', gap: 16 }}>
        {/* Tabela partnera */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Partner', 'QR', 'Popust', 'Rezerv.', 'Provizija', 'Preostalo', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: selectedPartner?.id === p.id ? '#f0fdf8' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 500, color: '#111' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.contact_name}{p.phone && ` · ${p.phone}`}</div>
                      {p.portal_email && <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 1 }}>Portal: {p.portal_email}</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <a href={`${siteUrl}/?ref=${p.qr_code}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontFamily: 'monospace', color: '#854F0B', background: '#FAEEDA', padding: '3px 8px', borderRadius: 20, textDecoration: 'none' }}>{p.qr_code}</a>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 12, background: '#E1F5EE', color: '#085041', padding: '3px 8px', borderRadius: 20 }}>{p.client_discount_percent || 0}%</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{p.reservation_count}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1D9E75' }}>{p.commission_earned?.toFixed(2)}€</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontWeight: 600, color: (p.commission_remaining || 0) > 0 ? '#BA7517' : '#9ca3af' }}>
                        {p.commission_remaining?.toFixed(2)}€
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(p)} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>Uredi</button>
                        <button onClick={() => openPayouts(p)} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #5DCAA5', borderRadius: 6, background: selectedPartner?.id === p.id ? '#E1F5EE' : 'transparent', cursor: 'pointer', color: '#0F6E56', fontWeight: 500 }}>Isplata</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel za uređivanje */}
        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editPartner ? 'Uredi partnera' : 'Novi partner'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            {[{ label: 'Naziv *', key: 'name', ph: 'Vila Jadran' }, { label: 'Kontakt osoba', key: 'contact_name', ph: 'Marko Petrović' }, { label: 'Email (kontakt)', key: 'email', ph: 'vlasnik@email.com' }, { label: 'Portal email (Google login)', key: 'portal_email', ph: 'marko@gmail.com' }, { label: 'Telefon', key: 'phone', ph: '+382 67 111 222' }, { label: 'QR kod *', key: 'qr_code', ph: 'AP-0001' }].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={lbl}>{f.label}</label>
                <input style={inp} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} placeholder={f.ph} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={lbl}>Provizija (%)</label>
                <input style={inp} type="number" min="0" max="100" step="0.5" value={form.commission_percent} onChange={e => setForm(fm => ({ ...fm, commission_percent: e.target.value }))} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Interni prihod</div>
              </div>
              <div>
                <label style={lbl}>Popust klijentu (%)</label>
                <input style={inp} type="number" min="0" max="100" step="0.5" value={form.client_discount_percent} onChange={e => setForm(fm => ({ ...fm, client_discount_percent: e.target.value }))} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Vidljiv klijentu</div>
              </div>
            </div>
            <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#0C447C', marginBottom: 16 }}>
              Partner se prijavljuje na <strong>/partner/login</strong> sa Google nalogom koji odgovara "Portal email".
            </div>
            <button onClick={savePartner} disabled={saving} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Snimanje...' : editPartner ? 'Sačuvaj' : 'Dodaj partnera'}
            </button>
          </div>
        )}

        {/* Panel za isplate */}
        {selectedPartner && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Isplate — {selectedPartner.name}</div>
              <button onClick={() => setSelectedPartner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Sažetak */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, marginTop: 12 }}>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Ukupno zarađeno</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>{selectedPartner.commission_earned?.toFixed(2)}€</div>
              </div>
              <div style={{ background: (selectedPartner.commission_remaining || 0) > 0 ? '#FAEEDA' : '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Dug prema partneru</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: (selectedPartner.commission_remaining || 0) > 0 ? '#BA7517' : '#374151' }}>{selectedPartner.commission_remaining?.toFixed(2)}€</div>
              </div>
            </div>

            {/* Nova isplata */}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>Pošalji zahtjev za isplatu</div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>Iznos (€)</label>
                <input style={inp} type="number" step="0.01" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder={selectedPartner.commission_remaining?.toFixed(2)} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Napomena (opciono)</label>
                <input style={inp} value={payoutNote} onChange={e => setPayoutNote(e.target.value)} placeholder="Isplata za april 2024." />
              </div>
              <button onClick={sendPayout} disabled={payoutSaving || !payoutAmount} style={{ width: '100%', padding: '9px', background: payoutSaving || !payoutAmount ? '#9ca3af' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: payoutSaving || !payoutAmount ? 'not-allowed' : 'pointer' }}>
                {payoutSaving ? 'Slanje...' : 'Pošalji zahtjev za isplatu'}
              </button>
            </div>

            {/* Istorija isplata */}
            {payouts.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Istorija isplata</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {payouts.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 600, color: '#1D9E75' }}>{p.amount.toFixed(2)}€</span>
                        {p.note && <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>{p.note}</span>}
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, background: p.status === 'confirmed' ? '#E1F5EE' : '#FAEEDA', color: p.status === 'confirmed' ? '#085041' : '#633806' }}>
                        {p.status === 'confirmed' ? 'Potvrđeno' : 'Čeka potvrdu'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
