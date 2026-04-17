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
  status: string; qr_source: string | null; created_at: string
  vehicles: { name: string } | null
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  completed: { bg: '#E6F1FB', color: '#0C447C', label: 'Završeno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

export default function AdminPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('reservations').select('*, vehicles(name)').order('created_at', { ascending: false }).limit(50)
    setReservations(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('reservations').update({ status }).eq('id', id)
    fetchData()
  }

  const now = new Date()
  const thisMonth = reservations.filter(r => { const d = new Date(r.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const revenue = thisMonth.reduce((s, r) => s + (r.total_price || 0), 0)
  const pending = reservations.filter(r => r.status === 'pending')

  const metric = { background: '#f3f4f6', borderRadius: 8, padding: 16 }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 24 }}>Pregled</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 28 }}>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Rezervacije ovaj mj.</div><div style={{ fontSize: 24, fontWeight: 600, color: '#111' }}>{thisMonth.length}</div></div>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Prihod ovaj mj.</div><div style={{ fontSize: 24, fontWeight: 600, color: '#1D9E75' }}>{revenue.toFixed(0)}€</div></div>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Provizije (est.)</div><div style={{ fontSize: 24, fontWeight: 600, color: '#BA7517' }}>{(revenue * 0.1).toFixed(0)}€</div></div>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Na čekanju</div><div style={{ fontSize: 24, fontWeight: 600, color: pending.length > 0 ? '#dc2626' : '#111' }}>{pending.length}</div></div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 14 }}>Posljednje rezervacije</div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
        ) : reservations.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema rezervacija.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Ref', 'Gost', 'Vozilo', 'Datumi', 'Iznos', 'Izvor', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.slice(0, 10).map(r => {
                const st = ST[r.status] || ST.pending
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{r.ref_code}</td>
                    <td style={{ padding: '10px 14px' }}><div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div></td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{r.vehicles?.name || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>{r.pickup_date}<br/>{r.return_date}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1D9E75' }}>{r.total_price}€</td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.qr_source ? <span style={{ fontSize: 11, background: '#FAEEDA', color: '#854F0B', padding: '2px 7px', borderRadius: 20 }}>{r.qr_source}</span> : <span style={{ fontSize: 11, color: '#9ca3af' }}>direktno</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.status === 'pending' && <button onClick={() => updateStatus(r.id, 'confirmed')} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #5DCAA5', borderRadius: 6, background: 'transparent', color: '#0F6E56', cursor: 'pointer' }}>Potvrdi</button>}
                      {r.status === 'confirmed' && <button onClick={() => updateStatus(r.id, 'completed')} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Završi</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
