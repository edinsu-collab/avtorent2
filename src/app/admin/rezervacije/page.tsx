'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Reservation = {
  id: string; ref_code: string; guest_name: string; guest_email: string; guest_phone: string
  guest_nationality: string; pickup_date: string; return_date: string; pickup_time: string
  return_time: string; pickup_location: string; notes: string
  total_price: number; final_total: number | null; base_price: number; extras_total: number
  commission_amount: number; status: string; payment_status: string
  amount_paid: number; amount_debt: number; amount_prepaid: number; surcharges_total: number
  issued_at: string | null; issued_by: string | null
  closed_at: string | null; closed_by: string | null
  is_early_return: boolean; original_return_date: string | null; original_return_time: string | null
  early_return_note: string | null; early_return_at: string | null
  qr_source: string | null; agent_name: string | null; created_at: string
  vehicles: { name: string } | null; partners: { name: string } | null
}

type SurchargeType = { id: string; name: string; is_active: boolean; sort_order: number }

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  issued:    { bg: '#E6F1FB', color: '#0C447C', label: 'Izdato' },
  closed:    { bg: '#f3f4f6', color: '#374151', label: 'Zatvoreno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

const PS: Record<string, { bg: string; color: string; label: string }> = {
  unpaid:   { bg: '#FAEEDA', color: '#633806', label: 'Neplaćeno' },
  paid:     { bg: '#E1F5EE', color: '#085041', label: 'Plaćeno' },
  debt:     { bg: '#FCEBEB', color: '#791F1F', label: 'DUG' },
  prepaid:  { bg: '#E6F1FB', color: '#0C447C', label: 'PRETPLATA' },
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [surchargeTypes, setSurchargeTypes] = useState<SurchargeType[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  // Modal states
  const [modal, setModal] = useState<'issue' | 'close' | 'edit' | null>(null)

  // Issue modal
  const [issuePaymentMode, setIssuePaymentMode] = useState<'full' | 'other'>('full')
  const [issueAmount, setIssueAmount] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)

  // Close modal
  const [closeStep, setCloseStep] = useState<'debt_check' | 'surcharges' | 'confirm'>(
    'debt_check'
  )
  const [debtCollected, setDebtCollected] = useState<boolean | null>(null)
  const [prepaidReturned, setPrepaidReturned] = useState<boolean | null>(null)
  const [hasSurcharges, setHasSurcharges] = useState<boolean | null>(null)
  const [surchargeAmounts, setSurchargeAmounts] = useState<Record<string, string>>({})
  const [customSurcharge, setCustomSurcharge] = useState('')
  const [customSurchargeAmount, setCustomSurchargeAmount] = useState('')
  const [closeSaving, setCloseSaving] = useState(false)

  // Early return modal
  const [earlyReturnNote, setEarlyReturnNote] = useState('')

  // Edit modal
  const [editForm, setEditForm] = useState<Partial<Reservation>>({})
  const [editSaving, setEditSaving] = useState(false)

  const agentName = getCookie('avtorent-agent-name')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: res }, { data: st }] = await Promise.all([
      supabase.from('reservations').select('*, vehicles(name), partners(name)').order('created_at', { ascending: false }),
      supabase.from('surcharge_types').select('*').eq('is_active', true).order('sort_order'),
    ])
    setReservations(res || [])
    setSurchargeTypes(st || [])
    setLoading(false)
  }

  function openModal(type: 'issue' | 'close' | 'edit', r: Reservation) {
    setSelected(r)
    setModal(type)
    if (type === 'issue') {
      setIssuePaymentMode('full')
      setIssueAmount(String(r.total_price))
    }
    if (type === 'close') {
      setCloseStep(r.payment_status === 'debt' || r.payment_status === 'prepaid' ? 'debt_check' : 'surcharges')
      setDebtCollected(null)
      setPrepaidReturned(null)
      setHasSurcharges(null)
      setSurchargeAmounts({})
      setCustomSurcharge('')
      setCustomSurchargeAmount('')
      setEarlyReturnNote('')
    }
    if (type === 'edit') {
      setEditForm({
        guest_name: r.guest_name, guest_email: r.guest_email, guest_phone: r.guest_phone,
        guest_nationality: r.guest_nationality, pickup_date: r.pickup_date, return_date: r.return_date,
        pickup_time: r.pickup_time, return_time: r.return_time, pickup_location: r.pickup_location,
        notes: r.notes, total_price: r.total_price,
      })
    }
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
  }

  // IZDAJ I NAPLATI
  async function handleIssue() {
    if (!selected) return
    setIssueSaving(true)
    const paid = issuePaymentMode === 'full' ? selected.total_price : parseFloat(issueAmount || '0')
    const diff = paid - selected.total_price
    const paymentStatus = Math.abs(diff) < 0.01 ? 'paid' : diff < 0 ? 'debt' : 'prepaid'
    const debt = diff < 0 ? Math.abs(diff) : 0
    const prepaid = diff > 0 ? diff : 0

    await supabase.from('reservations').update({
      status: 'issued',
      payment_status: paymentStatus,
      amount_paid: paid,
      amount_debt: debt,
      amount_prepaid: prepaid,
      issued_at: new Date().toISOString(),
      issued_by: agentName || 'Agent',
    }).eq('id', selected.id)

    await supabase.from('agent_collections').insert({
      reservation_id: selected.id,
      agent_name: agentName || 'Agent',
      amount: paid,
      collection_type: 'rental',
      note: `Naplata pri izdavanju vozila. Ref: ${selected.ref_code}`,
    })

    setIssueSaving(false)
    closeModal()
    fetchData()
  }

  // ZATVORI REZERVACIJU
  async function handleClose() {
    if (!selected) return
    setCloseSaving(true)

    const surcharges = surchargeTypes
      .filter(st => surchargeAmounts[st.id] && parseFloat(surchargeAmounts[st.id]) > 0)
      .map(st => ({ reservation_id: selected.id, name: st.name, amount: parseFloat(surchargeAmounts[st.id]) }))

    if (customSurcharge && customSurchargeAmount && parseFloat(customSurchargeAmount) > 0) {
      surcharges.push({ reservation_id: selected.id, name: customSurcharge, amount: parseFloat(customSurchargeAmount) })
    }

    const surchargesTotal = surcharges.reduce((s, c) => s + c.amount, 0)

    if (surcharges.length > 0) {
      await supabase.from('reservation_surcharges').insert(surcharges)
      // Zabilježi doplate kao naplatu agenta
      for (const s of surcharges) {
        await supabase.from('agent_collections').insert({
          reservation_id: selected.id,
          agent_name: agentName || 'Agent',
          amount: s.amount,
          collection_type: 'surcharge',
          note: s.name,
        })
      }
    }

    // Zabilježi naplatu duga ili povrat pretplate
    if (selected.payment_status === 'debt' && debtCollected) {
      await supabase.from('agent_collections').insert({
        reservation_id: selected.id,
        agent_name: agentName || 'Agent',
        amount: selected.amount_debt,
        collection_type: 'debt_collected',
        note: 'Naplata preostalog duga pri zatvaranju rezervacije',
      })
    }
    if (selected.payment_status === 'prepaid' && prepaidReturned) {
      await supabase.from('agent_collections').insert({
        reservation_id: selected.id,
        agent_name: agentName || 'Agent',
        amount: -selected.amount_prepaid,
        collection_type: 'prepaid_returned',
        note: 'Povrat pretplate klijentu',
      })
    }

    const finalTotal = (selected.final_total || selected.total_price) + surchargesTotal
    const now = new Date()
    const updateData: any = {
      status: 'closed',
      surcharges_total: surchargesTotal,
      final_total: finalTotal,
      closed_at: now.toISOString(),
      closed_by: agentName || 'Agent',
    }

    // Rano vraćanje
    if (selected.return_date > today) {
      updateData.is_early_return = true
      updateData.early_return_at = now.toISOString()
      updateData.early_return_note = earlyReturnNote || 'Vozilo vraćeno prije isteka'
      updateData.original_return_date = selected.return_date
      updateData.original_return_time = selected.return_time
      updateData.return_date = today
      updateData.return_time = now.toTimeString().slice(0, 5)
    }

    await supabase.from('reservations').update(updateData).eq('id', selected.id)
    setCloseSaving(false)
    closeModal()
    fetchData()
  }

  // EDIT
  async function handleEdit() {
    if (!selected) return
    setEditSaving(true)
    await supabase.from('reservations').update(editForm).eq('id', selected.id)
    setEditSaving(false)
    closeModal()
    fetchData()
  }

  async function handleCancel(id: string) {
    if (!confirm('Otkazati ovu rezervaciju?')) return
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id)
    fetchData()
    if (selected?.id === id) closeModal()
  }

  const filtered = reservations.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return r.guest_name?.toLowerCase().includes(q) || r.ref_code?.toLowerCase().includes(q) || r.guest_phone?.includes(q)
    }
    return true
  })

  const inp = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }

  const isEarlyReturn = selected && selected.return_date > today && selected.status === 'issued'

  // Ukupno surcharges
  const surchargesSum = surchargeTypes.reduce((s, st) => s + (parseFloat(surchargeAmounts[st.id] || '0') || 0), 0)
    + (parseFloat(customSurchargeAmount || '0') || 0)

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 20 }}>Rezervacije</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
          <option value="all">Svi statusi</option>
          <option value="pending">Na čekanju</option>
          <option value="confirmed">Potvrđeno</option>
          <option value="issued">Izdato</option>
          <option value="closed">Zatvoreno</option>
          <option value="cancelled">Otkazano</option>
        </select>
        <input style={{ ...inp, width: 220 }} placeholder="Pretraži..." value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>{filtered.length} rezervacija</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected && !modal ? '1fr 340px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Ref', 'Gost', 'Vozilo', 'Period', 'Iznos', 'Status', 'Plaćanje', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = ST[r.status] || ST.pending
                  const ps = PS[r.payment_status] || PS.unpaid
                  return (
                    <tr key={r.id} onClick={() => setSelected(selected?.id === r.id ? null : r)}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === r.id ? '#f0fdf8' : r.is_early_return ? '#fefce8' : 'transparent' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{r.ref_code}</div>
                        {r.is_early_return && <span style={{ fontSize: 10, background: '#fef08a', color: '#854d0e', padding: '1px 5px', borderRadius: 10, fontWeight: 600 }}>Rano</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>{r.vehicles?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {r.pickup_date}<br/>
                        {r.is_early_return
                          ? <span><s style={{ color: '#d1d5db' }}>{r.original_return_date}</s> <span style={{ color: '#854d0e' }}>{r.return_date}</span></span>
                          : r.return_date}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75', whiteSpace: 'nowrap' }}>
                        {r.final_total || r.total_price}€
                        {r.surcharges_total > 0 && <div style={{ fontSize: 10, color: '#BA7517' }}>+{r.surcharges_total}€ doplate</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.payment_status !== 'unpaid' && (
                          <span style={{ fontSize: 11, background: ps.bg, color: ps.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{ps.label}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(r.status === 'confirmed' || r.status === 'pending') && (
                            <button onClick={() => openModal('edit', r)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>Uredi</button>
                          )}
                          {(r.status === 'confirmed' || r.status === 'pending') && (
                            <button onClick={() => openModal('issue', r)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #185FA5', borderRadius: 6, background: '#E6F1FB', cursor: 'pointer', color: '#185FA5', fontWeight: 500 }}>Izdaj</button>
                          )}
                          {r.status === 'issued' && (
                            <button onClick={() => openModal('close', r)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #1D9E75', borderRadius: 6, background: '#E1F5EE', cursor: 'pointer', color: '#085041', fontWeight: 500 }}>Preuzmi</button>
                          )}
                          {(r.status === 'pending' || r.status === 'confirmed') && (
                            <button onClick={() => handleCancel(r.id)} style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>Otkaži</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && !modal && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, fontSize: 13, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{selected.guest_name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{selected.ref_code}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            {selected.is_early_return && (
              <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#854d0e', marginBottom: 3 }}>Rano vraćeno</div>
                <div style={{ color: '#713f12' }}>Original: {selected.original_return_date}</div>
                {selected.early_return_note && <div style={{ color: '#713f12', marginTop: 3 }}>Razlog: {selected.early_return_note}</div>}
              </div>
            )}

            {selected.payment_status === 'debt' && (
              <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#791F1F' }}>DUG: {selected.amount_debt.toFixed(2)}€</div>
              </div>
            )}
            {selected.payment_status === 'prepaid' && (
              <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#0C447C' }}>PRETPLATA: {selected.amount_prepaid.toFixed(2)}€</div>
              </div>
            )}

            {[
              ['Vozilo', selected.vehicles?.name],
              ['Email', selected.guest_email],
              ['Telefon', selected.guest_phone],
              ['Preuzimanje', `${selected.pickup_date} ${selected.pickup_time?.slice(0,5)}`],
              ['Vraćanje', `${selected.return_date} ${selected.return_time?.slice(0,5)}`],
              ['Lokacija', selected.pickup_location],
              ['Osnovni iznos', `${selected.total_price}€`],
              ['Doplate', selected.surcharges_total ? `${selected.surcharges_total}€` : '—'],
              ['Ukupno', `${selected.final_total || selected.total_price}€`],
              ['Naplaćeno', selected.amount_paid ? `${selected.amount_paid}€` : '—'],
              ['Izdao', selected.issued_by || '—'],
              ['Zatvorio', selected.closed_by || '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                <span style={{ color: '#9ca3af' }}>{l}</span>
                <span style={{ color: l === 'Ukupno' ? '#1D9E75' : '#111', fontWeight: l === 'Ukupno' ? 600 : 400 }}>{v || '—'}</span>
              </div>
            ))}

            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(selected.status === 'confirmed' || selected.status === 'pending') && (
                <>
                  <button onClick={() => openModal('edit', selected)} style={{ padding: 9, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Uredi rezervaciju</button>
                  <button onClick={() => openModal('issue', selected)} style={{ padding: 9, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Izdaj i naplati</button>
                  <button onClick={() => handleCancel(selected.id)} style={{ padding: 9, background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Otkaži</button>
                </>
              )}
              {selected.status === 'issued' && (
                <button onClick={() => openModal('close', selected)} style={{ padding: 9, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Preuzmi vozilo</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL OVERLAY */}
      {modal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>

          {/* IZDAJ I NAPLATI */}
          {modal === 'issue' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 440, width: '100%' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Izdaj i naplati</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{selected.ref_code} — {selected.guest_name} — {selected.vehicles?.name}</div>

              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Ukupno za naplatu</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{selected.total_price}€</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10 }}>Naplaćeni iznos</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button onClick={() => { setIssuePaymentMode('full'); setIssueAmount(String(selected.total_price)) }}
                    style={{ flex: 1, padding: '10px', border: `1px solid ${issuePaymentMode === 'full' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issuePaymentMode === 'full' ? '#E1F5EE' : '#fff', color: issuePaymentMode === 'full' ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: issuePaymentMode === 'full' ? 600 : 400, fontSize: 13 }}>
                    Pun iznos ({selected.total_price}€)
                  </button>
                  <button onClick={() => { setIssuePaymentMode('other'); setIssueAmount('') }}
                    style={{ flex: 1, padding: '10px', border: `1px solid ${issuePaymentMode === 'other' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issuePaymentMode === 'other' ? '#E1F5EE' : '#fff', color: issuePaymentMode === 'other' ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: issuePaymentMode === 'other' ? 600 : 400, fontSize: 13 }}>
                    Drugi iznos
                  </button>
                </div>
                {issuePaymentMode === 'other' && (
                  <input type="number" step="0.01" value={issueAmount} onChange={e => setIssueAmount(e.target.value)}
                    placeholder="Unesite naplaćeni iznos"
                    style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' as const, color: '#111' }} />
                )}
                {issuePaymentMode === 'other' && issueAmount && (
                  <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: parseFloat(issueAmount) < selected.total_price ? '#FCEBEB' : '#E6F1FB', fontSize: 13 }}>
                    {parseFloat(issueAmount) < selected.total_price
                      ? <span style={{ color: '#791F1F', fontWeight: 500 }}>DUG: {(selected.total_price - parseFloat(issueAmount)).toFixed(2)}€</span>
                      : <span style={{ color: '#0C447C', fontWeight: 500 }}>PRETPLATA: {(parseFloat(issueAmount) - selected.total_price).toFixed(2)}€</span>}
                  </div>
                )}
              </div>

              <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 20, fontSize: 12, color: '#0C447C' }}>
                Agent <strong>{agentName || 'Agent'}</strong> se zadužuje za naplaćeni iznos.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                <button onClick={handleIssue} disabled={issueSaving || (issuePaymentMode === 'other' && !issueAmount)}
                  style={{ flex: 2, padding: '10px', background: issueSaving ? '#5DCAA5' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {issueSaving ? '...' : 'Potvrdi naplatu i izdaj vozilo'}
                </button>
              </div>
            </div>
          )}

          {/* ZATVORI / PREUZMI VOZILO */}
          {modal === 'close' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Preuzmi vozilo</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{selected.ref_code} — {selected.guest_name}</div>

              {isEarlyReturn && (
                <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#713f12' }}>
                  Vozilo se vraća prije isteka roka ({selected.return_date}). Finansije se ažuriraju prema stvarnom datumu.
                </div>
              )}

              {/* KORAK 1: Dug/Pretplata provjera */}
              {closeStep === 'debt_check' && (
                <div>
                  {selected.payment_status === 'debt' && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#791F1F', marginBottom: 4 }}>Postoji DUG: {selected.amount_debt.toFixed(2)}€</div>
                        <div style={{ fontSize: 12, color: '#991B1B' }}>Klijent duguje ovaj iznos koji nije naplaćen pri izdavanju vozila.</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Da li je dug naplaćen?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setDebtCollected(true)} style={{ flex: 1, padding: '10px', border: `1px solid ${debtCollected === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: debtCollected === true ? '#E1F5EE' : '#fff', color: debtCollected === true ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: debtCollected === true ? 600 : 400 }}>Da, naplaćeno</button>
                        <button onClick={() => setDebtCollected(false)} style={{ flex: 1, padding: '10px', border: `1px solid ${debtCollected === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: debtCollected === false ? '#FCEBEB' : '#fff', color: debtCollected === false ? '#791F1F' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: debtCollected === false ? 600 : 400 }}>Ne, ostaje dug</button>
                      </div>
                    </div>
                  )}
                  {selected.payment_status === 'prepaid' && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0C447C', marginBottom: 4 }}>PRETPLATA: {selected.amount_prepaid.toFixed(2)}€</div>
                        <div style={{ fontSize: 12, color: '#1e40af' }}>Klijent je platio više od ukupnog iznosa.</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Da li je pretplata vraćena klijentu?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setPrepaidReturned(true)} style={{ flex: 1, padding: '10px', border: `1px solid ${prepaidReturned === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: prepaidReturned === true ? '#E1F5EE' : '#fff', color: prepaidReturned === true ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: prepaidReturned === true ? 600 : 400 }}>Da, vraćeno</button>
                        <button onClick={() => setPrepaidReturned(false)} style={{ flex: 1, padding: '10px', border: `1px solid ${prepaidReturned === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: prepaidReturned === false ? '#FCEBEB' : '#fff', color: prepaidReturned === false ? '#791F1F' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: prepaidReturned === false ? 600 : 400 }}>Ne, nije vraćeno</button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button onClick={closeModal} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                    <button
                      onClick={() => setCloseStep('surcharges')}
                      disabled={(selected.payment_status === 'debt' && debtCollected === null) || (selected.payment_status === 'prepaid' && prepaidReturned === null)}
                      style={{ flex: 2, padding: '10px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Dalje →
                    </button>
                  </div>
                </div>
              )}

              {/* KORAK 2: Doplate */}
              {closeStep === 'surcharges' && (
                <div>
                  {isEarlyReturn && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Razlog prijevremenog povratka *</label>
                      <textarea value={earlyReturnNote} onChange={e => setEarlyReturnNote(e.target.value)}
                        placeholder="Unesite razlog..."
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 70, resize: 'vertical' as const, boxSizing: 'border-box' as const, color: '#111' }} />
                    </div>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 12 }}>Da li postoje doplate?</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button onClick={() => setHasSurcharges(true)} style={{ flex: 1, padding: '10px', border: `1px solid ${hasSurcharges === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: hasSurcharges === true ? '#E1F5EE' : '#fff', color: hasSurcharges === true ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: hasSurcharges === true ? 600 : 400 }}>Da</button>
                    <button onClick={() => setHasSurcharges(false)} style={{ flex: 1, padding: '10px', border: `1px solid ${hasSurcharges === false ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: hasSurcharges === false ? '#E1F5EE' : '#fff', color: hasSurcharges === false ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: hasSurcharges === false ? 600 : 400 }}>Ne</button>
                  </div>

                  {hasSurcharges === true && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {surchargeTypes.map(st => (
                        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                          <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{st.name}</span>
                          <input type="number" step="0.01" placeholder="0" value={surchargeAmounts[st.id] || ''}
                            onChange={e => setSurchargeAmounts(s => ({ ...s, [st.id]: e.target.value }))}
                            style={{ width: 80, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' as const, color: '#111' }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                        </div>
                      ))}
                      {/* Custom doplata */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', border: '1px dashed #d1d5db', borderRadius: 8 }}>
                        <input placeholder="Naziv doplate" value={customSurcharge} onChange={e => setCustomSurcharge(e.target.value)}
                          style={{ flex: 1, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#111' }} />
                        <input type="number" step="0.01" placeholder="0" value={customSurchargeAmount} onChange={e => setCustomSurchargeAmount(e.target.value)}
                          style={{ width: 80, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' as const, color: '#111' }} />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                      </div>
                      {surchargesSum > 0 && (
                        <div style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#633806', fontWeight: 500 }}>
                          Ukupno doplate: {surchargesSum.toFixed(2)}€
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => {
                      if (selected.payment_status === 'debt' || selected.payment_status === 'prepaid') {
                        setCloseStep('debt_check')
                      } else {
                        closeModal()
                      }
                    }} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>← Nazad</button>
                    <button
                      onClick={handleClose}
                      disabled={hasSurcharges === null || closeSaving || (!!isEarlyReturn && !earlyReturnNote.trim())}
                      style={{ flex: 2, padding: '10px', background: closeSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {closeSaving ? '...' : 'Zatvori rezervaciju'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EDIT MODAL */}
          {modal === 'edit' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Uredi rezervaciju</div>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
              </div>

              {[
                { label: 'Ime gosta', key: 'guest_name', type: 'text' },
                { label: 'Email', key: 'guest_email', type: 'email' },
                { label: 'Telefon', key: 'guest_phone', type: 'text' },
                { label: 'Nacionalnost', key: 'guest_nationality', type: 'text' },
                { label: 'Datum preuzimanja', key: 'pickup_date', type: 'date' },
                { label: 'Vrijeme preuzimanja', key: 'pickup_time', type: 'time' },
                { label: 'Datum vraćanja', key: 'return_date', type: 'date' },
                { label: 'Vrijeme vraćanja', key: 'return_time', type: 'time' },
                { label: 'Lokacija', key: 'pickup_location', type: 'text' },
                { label: 'Ukupan iznos (€)', key: 'total_price', type: 'number' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={String((editForm as any)[f.key] || '')}
                    onChange={e => setEditForm(ef => ({ ...ef, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' as const, color: '#111' }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Napomena</label>
                <textarea value={String(editForm.notes || '')} onChange={e => setEditForm(ef => ({ ...ef, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 70, resize: 'vertical' as const, boxSizing: 'border-box' as const, color: '#111' }} />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                <button onClick={handleEdit} disabled={editSaving} style={{ flex: 2, padding: '10px', background: editSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {editSaving ? '...' : 'Sačuvaj izmjene'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
