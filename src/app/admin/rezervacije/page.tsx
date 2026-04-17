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
  return_time: string; pickup_location: string; notes: string; total_price: number
  commission_amount: number; commission_percent: number; base_price: number; extras_total: number
  status: string; qr_source: string | null; language: string; created_at: string
  agent_name: string | null; early_return_note: string | null; early_return_at: string | null
  original_return_date: string | null; original_return_time: string | null
  is_early_return: boolean
  vehicles: { name: string } | null; partners: { name: string } | null
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  completed: { bg: '#E6F1FB', color: '#0C447C', label: 'Završeno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [showEarlyReturnModal, setShowEarlyReturnModal] = useState(false)
  const [earlyReturnNote, setEarlyReturnNote] = useState('')
  const [earlyReturnSaving, setEarlyReturnSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase
      .from('reservations')
      .select('*, vehicles(name), partners(name)')
      .order('created_at', { ascending: false })
    setReservations(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('reservations').update({ status }).eq('id', id)
    fetchData()
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : null)
  }

  async function handleEarlyReturn() {
    if (!selected || !earlyReturnNote.trim()) return
    setEarlyReturnSaving(true)

    const now = new Date()
    const nowDate = now.toISOString().split('T')[0]
    const nowTime = now.toTimeString().slice(0, 5)

    await supabase.from('reservations').update({
      status: 'completed',
      is_early_return: true,
      early_return_at: now.toISOString(),
      early_return_note: earlyReturnNote.trim(),
      original_return_date: selected.return_date,
      original_return_time: selected.return_time,
      return_date: nowDate,
      return_time: nowTime,
    }).eq('id', selected.id)

    setEarlyReturnSaving(false)
    setShowEarlyReturnModal(false)
    setEarlyReturnNote('')
    fetchData()
    setSelected(s => s ? {
      ...s,
      status: 'completed',
      is_early_return: true,
      early_return_at: now.toISOString(),
      early_return_note: earlyReturnNote.trim(),
      original_return_date: s.return_date,
      original_return_time: s.return_time,
      return_date: nowDate,
      return_time: nowTime,
    } : null)
  }

  const today = new Date().toISOString().split('T')[0]

  function canCompleteEarly(r: Reservation): boolean {
    return r.status === 'confirmed' && r.return_date > today
  }

  function canComplete(r: Reservation): boolean {
    return r.status === 'confirmed' && r.return_date <= today
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

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 20 }}>Rezervacije</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
          <option value="all">Svi statusi</option>
          <option value="pending">Na čekanju</option>
          <option value="confirmed">Potvrđeno</option>
          <option value="completed">Završeno</option>
          <option value="cancelled">Otkazano</option>
        </select>
        <input style={{ ...inp, width: 220 }} placeholder="Pretraži..." value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} rezervacija</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: 16 }}>
        {/* Tabela */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Ref', 'Gost', 'Vozilo', 'Datumi', 'Iznos', 'Izvor', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = ST[r.status] || ST.pending
                  return (
                    <tr key={r.id} onClick={() => setSelected(selected?.id === r.id ? null : r)}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === r.id ? '#f0fdf8' : r.is_early_return ? '#fefce8' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>
                        <div>{r.ref_code}</div>
                        {r.is_early_return && (
                          <span style={{ fontSize: 10, background: '#fef08a', color: '#854d0e', padding: '1px 5px', borderRadius: 10, fontWeight: 600 }}>Rano završeno</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#374151', fontSize: 12 }}>{r.vehicles?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {r.pickup_date}<br/>
                        {r.is_early_return ? (
                          <span>
                            <span style={{ textDecoration: 'line-through', color: '#d1d5db' }}>{r.original_return_date}</span>
                            <span style={{ color: '#854d0e', marginLeft: 4 }}>{r.return_date}</span>
                          </span>
                        ) : r.return_date}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75' }}>{r.total_price}€</td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.qr_source
                          ? <span style={{ fontSize: 11, background: '#FAEEDA', color: '#854F0B', padding: '2px 7px', borderRadius: 20 }}>{r.qr_source}</span>
                          : <span style={{ fontSize: 11, color: '#9ca3af' }}>direktno</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        {r.status === 'pending' && (
                          <button onClick={() => updateStatus(r.id, 'confirmed')}
                            style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #5DCAA5', borderRadius: 6, background: 'transparent', color: '#0F6E56', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Potvrdi
                          </button>
                        )}
                        {canComplete(r) && (
                          <button onClick={() => updateStatus(r.id, 'completed')}
                            style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #85B7EB', borderRadius: 6, background: 'transparent', color: '#185FA5', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Završi
                          </button>
                        )}
                        {canCompleteEarly(r) && (
                          <button onClick={() => { setSelected(r); setShowEarlyReturnModal(true) }}
                            style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #fbbf24', borderRadius: 6, background: '#fef9c3', color: '#854d0e', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Rano vrati
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, fontSize: 13, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{selected.guest_name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{selected.ref_code}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Oznaka ranog završetka */}
            {selected.is_early_return && (
              <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#854d0e', marginBottom: 4 }}>⚠ Rano završeno</div>
                <div style={{ fontSize: 12, color: '#713f12' }}>
                  Originalni datum vraćanja: <strong>{selected.original_return_date} u {selected.original_return_time?.slice(0,5)}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#713f12', marginTop: 4 }}>
                  Završeno: <strong>{selected.early_return_at ? new Date(selected.early_return_at).toLocaleString('sr-RS') : '—'}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#713f12', marginTop: 4 }}>
                  Razlog: <strong>{selected.early_return_note}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                  Finansijska vrijednost rezervacije ostaje nepromijenjena.
                </div>
              </div>
            )}

            {[
              ['Email', selected.guest_email],
              ['Telefon', selected.guest_phone],
              ['Nacionalnost', selected.guest_nationality],
              ['Vozilo', selected.vehicles?.name],
              ['Preuzimanje', `${selected.pickup_date} u ${selected.pickup_time?.slice(0,5) || '10:00'}`],
              ['Vraćanje', selected.is_early_return
                ? `${selected.return_date} u ${selected.return_time?.slice(0,5) || '10:00'} (izmijenjeno)`
                : `${selected.return_date} u ${selected.return_time?.slice(0,5) || '10:00'}`],
              ['Lokacija', selected.pickup_location],
              ['Osnovna cijena', `${selected.base_price || selected.total_price}€`],
              ['Dodaci', selected.extras_total ? `${selected.extras_total}€` : '—'],
              ['Ukupno', `${selected.total_price}€`],
              ['Provizija', selected.commission_amount ? `${selected.commission_amount.toFixed(2)}€` : '—'],
              ['Partner', selected.partners?.name || '—'],
              ['QR kod', selected.qr_source || '—'],
              ['Agent', selected.agent_name || '—'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>{l}</span>
                <span style={{ fontWeight: l === 'Ukupno' ? 600 : 400, color: l === 'Ukupno' ? '#1D9E75' : l === 'Vraćanje' && selected.is_early_return ? '#854d0e' : '#111', textAlign: 'right', maxWidth: 180 }}>{v || '—'}</span>
              </div>
            ))}

            {selected.notes && (
              <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 12, color: '#374151' }}>
                <div style={{ color: '#9ca3af', marginBottom: 4 }}>Napomena</div>
                {selected.notes}
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.status === 'pending' && (
                <button onClick={() => updateStatus(selected.id, 'confirmed')}
                  style={{ padding: 9, background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Potvrdi rezervaciju
                </button>
              )}
              {canComplete(selected) && (
                <button onClick={() => updateStatus(selected.id, 'completed')}
                  style={{ padding: 9, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Označi kao završeno
                </button>
              )}
              {canCompleteEarly(selected) && (
                <button onClick={() => setShowEarlyReturnModal(true)}
                  style={{ padding: 9, background: '#fef9c3', color: '#854d0e', border: '1px solid #fbbf24', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Rano vraćanje vozila
                </button>
              )}
              {(selected.status === 'pending' || selected.status === 'confirmed') && (
                <button onClick={() => updateStatus(selected.id, 'cancelled')}
                  style={{ padding: 9, background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                  Otkaži
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal za rano vraćanje */}
      {showEarlyReturnModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', maxWidth: 440, width: '90%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 6 }}>Rano vraćanje vozila</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              Rezervacija <strong>{selected.ref_code}</strong> — <strong>{selected.vehicles?.name}</strong>
            </div>

            <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#713f12' }}>
              Planirani datum vraćanja: <strong>{selected.return_date} u {selected.return_time?.slice(0,5) || '10:00'}</strong><br/>
              Novo vrijeme vraćanja: <strong>{new Date().toLocaleString('sr-RS')}</strong>
            </div>

            <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#0C447C' }}>
              Finansijska vrijednost rezervacije ({selected.total_price}€) ostaje nepromijenjena.
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                Razlog ranog vraćanja *
              </label>
              <textarea
                value={earlyReturnNote}
                onChange={e => setEarlyReturnNote(e.target.value)}
                placeholder="Unesite razlog zašto se vozilo vraća prije isteka najma..."
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: `1px solid ${earlyReturnNote.trim() ? '#d1d5db' : '#fbbf24'}`, borderRadius: 8, minHeight: 90, resize: 'vertical', boxSizing: 'border-box' as const, color: '#111' }}
              />
              {!earlyReturnNote.trim() && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>Komentar je obavezan</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowEarlyReturnModal(false); setEarlyReturnNote('') }}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}
              >
                Odustani
              </button>
              <button
                onClick={handleEarlyReturn}
                disabled={!earlyReturnNote.trim() || earlyReturnSaving}
                style={{ flex: 1, padding: '10px', background: !earlyReturnNote.trim() ? '#9ca3af' : '#854d0e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: !earlyReturnNote.trim() ? 'not-allowed' : 'pointer' }}
              >
                {earlyReturnSaving ? 'Snimanje...' : 'Potvrdi rano vraćanje'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
