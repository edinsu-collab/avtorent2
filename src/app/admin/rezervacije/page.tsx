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
  payment_method: string | null; cash_amount: number; card_amount: number; wire_amount: number
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
  unpaid:  { bg: '#FAEEDA', color: '#633806', label: 'Neplaćeno' },
  paid:    { bg: '#E1F5EE', color: '#085041', label: 'Plaćeno' },
  debt:    { bg: '#FCEBEB', color: '#791F1F', label: 'DUG' },
  prepaid: { bg: '#E6F1FB', color: '#0C447C', label: 'PRETPLATA' },
}

const PM_LABELS: Record<string, string> = { cash: 'Keš', card: 'Kartica', wire: 'Virmanski', split: 'Podijeljeno' }

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

type PaymentInput = {
  method: 'cash' | 'card' | 'wire' | 'split'
  cashAmount: string
  cardAmount: string
  wireAmount: string
}

function PaymentMethodSelector({ total, value, onChange }: { total: number; value: PaymentInput; onChange: (v: PaymentInput) => void }) {
  const splitTotal = (parseFloat(value.cashAmount || '0') + parseFloat(value.cardAmount || '0') + parseFloat(value.wireAmount || '0'))
  const remaining = total - splitTotal

  return (
    <div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Način plaćanja</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
        {(['cash', 'card', 'wire', 'split'] as const).map(m => (
          <button key={m} onClick={() => onChange({ ...value, method: m })}
            style={{ padding: '8px 4px', border: `1px solid ${value.method === m ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: value.method === m ? '#E1F5EE' : '#fff', color: value.method === m ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: value.method === m ? 600 : 400 }}>
            {PM_LABELS[m]}
          </button>
        ))}
      </div>

      {value.method === 'split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['cash', 'Keš', value.cashAmount], ['card', 'Kartica', value.cardAmount], ['wire', 'Virmanski', value.wireAmount]].map(([key, label, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280', width: 80 }}>{label}</span>
              <input type="number" step="0.01" placeholder="0" value={val}
                onChange={e => onChange({ ...value, [`${key}Amount`]: e.target.value } as PaymentInput)}
                style={{ flex: 1, padding: '7px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
            </div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 8, background: Math.abs(remaining) < 0.01 ? '#E1F5EE' : '#FAEEDA', fontSize: 12, color: Math.abs(remaining) < 0.01 ? '#085041' : '#633806' }}>
            {Math.abs(remaining) < 0.01 ? 'Iznosi se poklapaju' : `Preostalo: ${remaining.toFixed(2)}€`}
          </div>
        </div>
      )}
    </div>
  )
}

function getPaymentAmounts(payment: PaymentInput, total: number) {
  if (payment.method === 'cash') return { cash: total, card: 0, wire: 0 }
  if (payment.method === 'card') return { cash: 0, card: total, wire: 0 }
  if (payment.method === 'wire') return { cash: 0, card: 0, wire: total }
  return {
    cash: parseFloat(payment.cashAmount || '0'),
    card: parseFloat(payment.cardAmount || '0'),
    wire: parseFloat(payment.wireAmount || '0'),
  }
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [surchargeTypes, setSurchargeTypes] = useState<SurchargeType[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'issue' | 'close' | 'edit' | null>(null)

  // Issue modal
  const [issueMode, setIssueMode] = useState<'quick' | 'full'>('quick')
  const [issuePaymentMode, setIssuePaymentMode] = useState<'full' | 'other'>('full')
  const [issueAmount, setIssueAmount] = useState('')
  const [issuePayment, setIssuePayment] = useState<PaymentInput>({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
  const [issueSaving, setIssueSaving] = useState(false)

  // Close modal
  const [closeMode, setCloseMode] = useState<'quick' | 'full'>('quick')
  const [closeStep, setCloseStep] = useState<'debt_check' | 'surcharges'>('surcharges')
  const [debtCollected, setDebtCollected] = useState<boolean | null>(null)
  const [debtPayment, setDebtPayment] = useState<PaymentInput>({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
  const [prepaidReturned, setPrepaidReturned] = useState<boolean | null>(null)
  const [hasSurcharges, setHasSurcharges] = useState<boolean | null>(null)
  const [surchargeAmounts, setSurchargeAmounts] = useState<Record<string, string>>({})
  const [surchargePayments, setSurchargePayments] = useState<Record<string, PaymentInput>>({})
  const [customSurcharge, setCustomSurcharge] = useState('')
  const [customSurchargeAmount, setCustomSurchargeAmount] = useState('')
  const [earlyReturnNote, setEarlyReturnNote] = useState('')
  const [closeSaving, setCloseSaving] = useState(false)

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

  function isQuickIssue(r: Reservation) {
    return true // Agent odlučuje, ali default je brzo
  }

  function hasDebtOrPrepaid(r: Reservation) {
    return r.payment_status === 'debt' || r.payment_status === 'prepaid'
  }

  function openModal(type: 'issue' | 'close' | 'edit', r: Reservation) {
    setSelected(r)
    setModal(type)
    if (type === 'issue') {
      setIssueMode('quick')
      setIssuePaymentMode('full')
      setIssueAmount(String(r.total_price))
      setIssuePayment({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
    }
    if (type === 'close') {
      setCloseMode('quick')
      setCloseStep(hasDebtOrPrepaid(r) ? 'debt_check' : 'surcharges')
      setDebtCollected(null)
      setPrepaidReturned(null)
      setDebtPayment({ method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' })
      setHasSurcharges(null)
      setSurchargeAmounts({})
      setSurchargePayments({})
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

  function closeModal() { setModal(null); setSelected(null) }

  async function handleQuickIssue() {
    if (!selected) return
    setIssueSaving(true)
    const amounts = getPaymentAmounts(issuePayment, selected.total_price)
    await supabase.from('reservations').update({
      status: 'issued', payment_status: 'paid',
      amount_paid: selected.total_price,
      payment_method: issuePayment.method,
      cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      issued_at: new Date().toISOString(), issued_by: agentName || 'Agent',
    }).eq('id', selected.id)
    await supabase.from('agent_collections').insert({
      reservation_id: selected.id, agent_name: agentName || 'Agent',
      amount: selected.total_price, collection_type: 'rental',
      payment_method: issuePayment.method,
      cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      note: `Brzo izdavanje. Ref: ${selected.ref_code}`,
    })
    setIssueSaving(false); closeModal(); fetchData()
  }

  async function handleFullIssue() {
    if (!selected) return
    setIssueSaving(true)
    const paid = issuePaymentMode === 'full' ? selected.total_price : parseFloat(issueAmount || '0')
    const diff = paid - selected.total_price
    const paymentStatus = Math.abs(diff) < 0.01 ? 'paid' : diff < 0 ? 'debt' : 'prepaid'
    const amounts = getPaymentAmounts(issuePayment, paid)
    await supabase.from('reservations').update({
      status: 'issued', payment_status: paymentStatus,
      amount_paid: paid, amount_debt: diff < 0 ? Math.abs(diff) : 0, amount_prepaid: diff > 0 ? diff : 0,
      payment_method: issuePayment.method,
      cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      issued_at: new Date().toISOString(), issued_by: agentName || 'Agent',
    }).eq('id', selected.id)
    await supabase.from('agent_collections').insert({
      reservation_id: selected.id, agent_name: agentName || 'Agent',
      amount: paid, collection_type: 'rental',
      payment_method: issuePayment.method,
      cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
      note: `Ref: ${selected.ref_code}`,
    })
    setIssueSaving(false); closeModal(); fetchData()
  }

  async function handleQuickClose() {
    if (!selected) return
    setCloseSaving(true)
    const now = new Date()
    const updateData: any = {
      status: 'closed', final_total: selected.total_price,
      closed_at: now.toISOString(), closed_by: agentName || 'Agent',
    }
    if (selected.return_date > today) {
      updateData.is_early_return = true
      updateData.early_return_at = now.toISOString()
      updateData.early_return_note = 'Brzo preuzimanje'
      updateData.original_return_date = selected.return_date
      updateData.return_date = today
    }
    await supabase.from('reservations').update(updateData).eq('id', selected.id)
    setCloseSaving(false); closeModal(); fetchData()
  }

  async function handleFullClose() {
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
      for (const s of surcharges) {
        const sp = surchargePayments[s.name] || { method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' }
        const amounts = getPaymentAmounts(sp, s.amount)
        await supabase.from('agent_collections').insert({
          reservation_id: selected.id, agent_name: agentName || 'Agent',
          amount: s.amount, collection_type: 'surcharge',
          payment_method: sp.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
          note: s.name,
        })
      }
    }

    if (selected.payment_status === 'debt' && debtCollected) {
      const amounts = getPaymentAmounts(debtPayment, selected.amount_debt)
      await supabase.from('agent_collections').insert({
        reservation_id: selected.id, agent_name: agentName || 'Agent',
        amount: selected.amount_debt, collection_type: 'debt_collected',
        payment_method: debtPayment.method, cash_amount: amounts.cash, card_amount: amounts.card, wire_amount: amounts.wire,
        note: 'Naplata duga pri preuzimanju',
      })
    }
    if (selected.payment_status === 'prepaid' && prepaidReturned) {
      await supabase.from('agent_collections').insert({
        reservation_id: selected.id, agent_name: agentName || 'Agent',
        amount: -selected.amount_prepaid, collection_type: 'prepaid_returned',
        payment_method: 'cash', cash_amount: -selected.amount_prepaid, card_amount: 0, wire_amount: 0,
        note: 'Povrat pretplate klijentu',
      })
    }

    const finalTotal = (selected.final_total || selected.total_price) + surchargesTotal
    const now = new Date()
    const updateData: any = {
      status: 'closed', surcharges_total: surchargesTotal, final_total: finalTotal,
      closed_at: now.toISOString(), closed_by: agentName || 'Agent',
    }
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
    setCloseSaving(false); closeModal(); fetchData()
  }

  async function handleEdit() {
    if (!selected) return
    setEditSaving(true)
    await supabase.from('reservations').update(editForm).eq('id', selected.id)
    setEditSaving(false); closeModal(); fetchData()
  }

  async function handleCancel(id: string) {
    if (!confirm('Otkazati ovu rezervaciju?')) return
    await supabase.from('reservations').update({ status: 'cancelled', closed_by: agentName || 'Agent', closed_at: new Date().toISOString() }).eq('id', id)
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
  const surchargesSum = surchargeTypes.reduce((s, st) => s + (parseFloat(surchargeAmounts[st.id] || '0') || 0), 0)
    + (parseFloat(customSurchargeAmount || '0') || 0)

  const fullIssueAmount = issuePaymentMode === 'full' ? (selected?.total_price || 0) : parseFloat(issueAmount || '0')
  const issueDiff = selected ? fullIssueAmount - selected.total_price : 0

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
                        {r.is_early_return ? <span><s style={{ color: '#d1d5db' }}>{r.original_return_date}</s> <span style={{ color: '#854d0e' }}>{r.return_date}</span></span> : r.return_date}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75', whiteSpace: 'nowrap' }}>
                        {r.final_total || r.total_price}€
                        {r.surcharges_total > 0 && <div style={{ fontSize: 10, color: '#BA7517' }}>+{r.surcharges_total}€</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.payment_status !== 'unpaid' && (
                          <div>
                            <span style={{ fontSize: 11, background: ps.bg, color: ps.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{ps.label}</span>
                            {r.payment_method && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{PM_LABELS[r.payment_method]}</div>}
                          </div>
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
              <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#854d0e', marginBottom: 2 }}>Rano vraćeno</div>
                <div style={{ color: '#713f12' }}>Original: {selected.original_return_date}</div>
                {selected.early_return_note && <div style={{ color: '#713f12', marginTop: 2 }}>{selected.early_return_note}</div>}
              </div>
            )}
            {selected.payment_status === 'debt' && (
              <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, fontWeight: 600, color: '#791F1F' }}>
                DUG: {selected.amount_debt?.toFixed(2)}€
              </div>
            )}
            {selected.payment_status === 'prepaid' && (
              <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, fontWeight: 600, color: '#0C447C' }}>
                PRETPLATA: {selected.amount_prepaid?.toFixed(2)}€
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
              ['Naplaćeno', selected.amount_paid ? `${selected.amount_paid}€` : '—'],
              ['Način plaćanja', selected.payment_method ? PM_LABELS[selected.payment_method] : '—'],
              ...(selected.payment_method === 'split' ? [
                ['  Keš', `${selected.cash_amount}€`],
                ['  Kartica', `${selected.card_amount}€`],
                ['  Virmanski', `${selected.wire_amount}€`],
              ] : []),
              ['Doplate', selected.surcharges_total ? `${selected.surcharges_total}€` : '—'],
              ['Ukupno', `${selected.final_total || selected.total_price}€`],
              ['Izdao', selected.issued_by || '—'],
              ['Zatvorio', selected.closed_by || '—'],
            ].map(([l, v]) => (
              <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
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

      {/* MODALI */}
      {modal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>

          {/* IZDAJ MODAL */}
          {modal === 'issue' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Izdaj vozilo</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{selected.ref_code} — {selected.guest_name} — {selected.vehicles?.name}</div>

              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Ukupno za naplatu</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1D9E75' }}>{selected.total_price}€</span>
              </div>

              {/* Brzo vs Kompleksno */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button onClick={() => setIssueMode('quick')} style={{ flex: 1, padding: '10px', border: `2px solid ${issueMode === 'quick' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issueMode === 'quick' ? '#E1F5EE' : '#fff', color: issueMode === 'quick' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: issueMode === 'quick' ? 600 : 400 }}>
                  Brzo izdavanje
                </button>
                <button onClick={() => setIssueMode('full')} style={{ flex: 1, padding: '10px', border: `2px solid ${issueMode === 'full' ? '#185FA5' : '#e5e7eb'}`, borderRadius: 8, background: issueMode === 'full' ? '#E6F1FB' : '#fff', color: issueMode === 'full' ? '#0C447C' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: issueMode === 'full' ? 600 : 400 }}>
                  Prilagođeno
                </button>
              </div>

              {issueMode === 'quick' && (
                <div>
                  <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#085041' }}>
                    Pun iznos naplaćen ({selected.total_price}€). Odaberi način plaćanja.
                  </div>
                  <PaymentMethodSelector total={selected.total_price} value={issuePayment} onChange={setIssuePayment} />
                </div>
              )}

              {issueMode === 'full' && (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10 }}>Naplaćeni iznos</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <button onClick={() => { setIssuePaymentMode('full'); setIssueAmount(String(selected.total_price)) }}
                        style={{ flex: 1, padding: '9px', border: `1px solid ${issuePaymentMode === 'full' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issuePaymentMode === 'full' ? '#E1F5EE' : '#fff', color: issuePaymentMode === 'full' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 12 }}>
                        Pun iznos ({selected.total_price}€)
                      </button>
                      <button onClick={() => { setIssuePaymentMode('other'); setIssueAmount('') }}
                        style={{ flex: 1, padding: '9px', border: `1px solid ${issuePaymentMode === 'other' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: issuePaymentMode === 'other' ? '#E1F5EE' : '#fff', color: issuePaymentMode === 'other' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 12 }}>
                        Drugi iznos
                      </button>
                    </div>
                    {issuePaymentMode === 'other' && (
                      <input type="number" step="0.01" value={issueAmount} onChange={e => setIssueAmount(e.target.value)}
                        placeholder="Unesite naplaćeni iznos"
                        style={{ width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' as const, color: '#111', marginBottom: 8 }} />
                    )}
                    {issuePaymentMode === 'other' && issueAmount && Math.abs(issueDiff) > 0.01 && (
                      <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 10, background: issueDiff < 0 ? '#FCEBEB' : '#E6F1FB', fontSize: 13, fontWeight: 500, color: issueDiff < 0 ? '#791F1F' : '#0C447C' }}>
                        {issueDiff < 0 ? `DUG: ${Math.abs(issueDiff).toFixed(2)}€` : `PRETPLATA: ${issueDiff.toFixed(2)}€`}
                      </div>
                    )}
                  </div>
                  <PaymentMethodSelector total={fullIssueAmount} value={issuePayment} onChange={setIssuePayment} />
                </div>
              )}

              <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '8px 12px', margin: '16px 0', fontSize: 12, color: '#0C447C' }}>
                Agent <strong>{agentName || 'Agent'}</strong> se zadužuje za naplaćeni iznos.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                <button
                  onClick={issueMode === 'quick' ? handleQuickIssue : handleFullIssue}
                  disabled={issueSaving || (issueMode === 'full' && issuePaymentMode === 'other' && !issueAmount) || (issuePayment.method === 'split' && Math.abs((selected.total_price) - (parseFloat(issuePayment.cashAmount||'0') + parseFloat(issuePayment.cardAmount||'0') + parseFloat(issuePayment.wireAmount||'0'))) > 0.01 && issueMode === 'quick')}
                  style={{ flex: 2, padding: '10px', background: issueSaving ? '#5DCAA5' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {issueSaving ? '...' : 'Potvrdi i izdaj vozilo'}
                </button>
              </div>
            </div>
          )}

          {/* PREUZMI MODAL */}
          {modal === 'close' && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 4 }}>Preuzmi vozilo</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{selected.ref_code} — {selected.guest_name}</div>

              {isEarlyReturn && (
                <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#713f12' }}>
                  Vozilo se vraća prije isteka roka ({selected.return_date}).
                </div>
              )}

              {/* Brzo vs Kompleksno */}
              {!hasDebtOrPrepaid(selected) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button onClick={() => setCloseMode('quick')} style={{ flex: 1, padding: '10px', border: `2px solid ${closeMode === 'quick' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: closeMode === 'quick' ? '#E1F5EE' : '#fff', color: closeMode === 'quick' ? '#085041' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: closeMode === 'quick' ? 600 : 400 }}>
                    Brzo preuzimanje
                  </button>
                  <button onClick={() => setCloseMode('full')} style={{ flex: 1, padding: '10px', border: `2px solid ${closeMode === 'full' ? '#185FA5' : '#e5e7eb'}`, borderRadius: 8, background: closeMode === 'full' ? '#E6F1FB' : '#fff', color: closeMode === 'full' ? '#0C447C' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: closeMode === 'full' ? 600 : 400 }}>
                    Sa dopuni
                  </button>
                </div>
              )}

              {/* BRZO PREUZIMANJE */}
              {closeMode === 'quick' && !hasDebtOrPrepaid(selected) && (
                <div>
                  <div style={{ background: '#E1F5EE', border: '1px solid #5DCAA5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#085041' }}>
                    Nema duga, pretplate ni doplata. Vozilo se zatvara odmah.
                  </div>
                  {isEarlyReturn && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Razlog prijevremenog povratka *</label>
                      <textarea value={earlyReturnNote} onChange={e => setEarlyReturnNote(e.target.value)}
                        placeholder="Unesite razlog..."
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 60, resize: 'vertical' as const, boxSizing: 'border-box' as const, color: '#111' }} />
                    </div>
                  )}
                </div>
              )}

              {/* KOMPLEKSNO PREUZIMANJE */}
              {(closeMode === 'full' || hasDebtOrPrepaid(selected)) && (
                <div>
                  {/* Dug */}
                  {selected.payment_status === 'debt' && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#791F1F' }}>DUG: {selected.amount_debt?.toFixed(2)}€</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Da li je dug naplaćen?</div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button onClick={() => setDebtCollected(true)} style={{ flex: 1, padding: '9px', border: `1px solid ${debtCollected === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: debtCollected === true ? '#E1F5EE' : '#fff', color: debtCollected === true ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13 }}>Da</button>
                        <button onClick={() => setDebtCollected(false)} style={{ flex: 1, padding: '9px', border: `1px solid ${debtCollected === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: debtCollected === false ? '#FCEBEB' : '#fff', color: debtCollected === false ? '#791F1F' : '#374151', cursor: 'pointer', fontSize: 13 }}>Ne</button>
                      </div>
                      {debtCollected === true && (
                        <PaymentMethodSelector total={selected.amount_debt} value={debtPayment} onChange={setDebtPayment} />
                      )}
                    </div>
                  )}

                  {/* Pretplata */}
                  {selected.payment_status === 'prepaid' && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0C447C' }}>PRETPLATA: {selected.amount_prepaid?.toFixed(2)}€</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Da li je pretplata vraćena?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setPrepaidReturned(true)} style={{ flex: 1, padding: '9px', border: `1px solid ${prepaidReturned === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: prepaidReturned === true ? '#E1F5EE' : '#fff', color: prepaidReturned === true ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13 }}>Da</button>
                        <button onClick={() => setPrepaidReturned(false)} style={{ flex: 1, padding: '9px', border: `1px solid ${prepaidReturned === false ? '#dc2626' : '#e5e7eb'}`, borderRadius: 8, background: prepaidReturned === false ? '#FCEBEB' : '#fff', color: prepaidReturned === false ? '#791F1F' : '#374151', cursor: 'pointer', fontSize: 13 }}>Ne</button>
                      </div>
                    </div>
                  )}

                  {isEarlyReturn && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Razlog prijevremenog povratka *</label>
                      <textarea value={earlyReturnNote} onChange={e => setEarlyReturnNote(e.target.value)}
                        placeholder="Unesite razlog..."
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 60, resize: 'vertical' as const, boxSizing: 'border-box' as const, color: '#111' }} />
                    </div>
                  )}

                  {/* Doplate */}
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Da li postoje doplate?</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button onClick={() => setHasSurcharges(true)} style={{ flex: 1, padding: '9px', border: `1px solid ${hasSurcharges === true ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: hasSurcharges === true ? '#E1F5EE' : '#fff', color: hasSurcharges === true ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13 }}>Da</button>
                    <button onClick={() => setHasSurcharges(false)} style={{ flex: 1, padding: '9px', border: `1px solid ${hasSurcharges === false ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 8, background: hasSurcharges === false ? '#E1F5EE' : '#fff', color: hasSurcharges === false ? '#085041' : '#374151', cursor: 'pointer', fontSize: 13 }}>Ne</button>
                  </div>

                  {hasSurcharges === true && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      {surchargeTypes.map(st => (
                        <div key={st.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: surchargeAmounts[st.id] && parseFloat(surchargeAmounts[st.id]) > 0 ? 8 : 0 }}>
                            <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{st.name}</span>
                            <input type="number" step="0.01" placeholder="0" value={surchargeAmounts[st.id] || ''}
                              onChange={e => setSurchargeAmounts(s => ({ ...s, [st.id]: e.target.value }))}
                              style={{ width: 80, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' as const, color: '#111' }} />
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                          </div>
                          {surchargeAmounts[st.id] && parseFloat(surchargeAmounts[st.id]) > 0 && (
                            <PaymentMethodSelector
                              total={parseFloat(surchargeAmounts[st.id])}
                              value={surchargePayments[st.name] || { method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' }}
                              onChange={v => setSurchargePayments(s => ({ ...s, [st.name]: v }))}
                            />
                          )}
                        </div>
                      ))}
                      <div style={{ border: '1px dashed #d1d5db', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: customSurchargeAmount && parseFloat(customSurchargeAmount) > 0 ? 8 : 0 }}>
                          <input placeholder="Naziv doplate" value={customSurcharge} onChange={e => setCustomSurcharge(e.target.value)}
                            style={{ flex: 1, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, color: '#111' }} />
                          <input type="number" step="0.01" placeholder="0" value={customSurchargeAmount} onChange={e => setCustomSurchargeAmount(e.target.value)}
                            style={{ width: 80, padding: '5px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'right' as const, color: '#111' }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>€</span>
                        </div>
                        {customSurchargeAmount && parseFloat(customSurchargeAmount) > 0 && (
                          <PaymentMethodSelector
                            total={parseFloat(customSurchargeAmount)}
                            value={surchargePayments['custom'] || { method: 'cash', cashAmount: '', cardAmount: '', wireAmount: '' }}
                            onChange={v => setSurchargePayments(s => ({ ...s, custom: v }))}
                          />
                        )}
                      </div>
                      {surchargesSum > 0 && (
                        <div style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#633806', fontWeight: 500 }}>
                          Ukupno doplate: {surchargesSum.toFixed(2)}€
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={closeModal} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>Odustani</button>
                <button
                  onClick={closeMode === 'quick' && !hasDebtOrPrepaid(selected) ? handleQuickClose : handleFullClose}
                  disabled={closeSaving || ((closeMode === 'full' || hasDebtOrPrepaid(selected)) && hasSurcharges === null) || (!!isEarlyReturn && closeMode === 'quick' && !earlyReturnNote.trim() && selected.return_date > today) || (!!isEarlyReturn && closeMode === 'full' && !earlyReturnNote.trim() && selected.return_date > today)}
                  style={{ flex: 2, padding: '10px', background: closeSaving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {closeSaving ? '...' : 'Zatvori rezervaciju'}
                </button>
              </div>
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
                  <input type={f.type} value={String((editForm as any)[f.key] || '')}
                    onChange={e => setEditForm(ef => ({ ...ef, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' as const, color: '#111' }} />
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
