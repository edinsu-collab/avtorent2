'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Reservation = {
  id: string
  ref_code: string
  guest_name: string
  guest_phone: string
  pickup_date: string
  return_date: string
  pickup_time: string
  return_time: string
  pickup_location: string
  total_price: number
  status: string
  agent_name: string | null
  vehicles: { name: string; category: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Na čekanju',
  confirmed: 'Potvrđeno',
  completed: 'Završeno',
  cancelled: 'Otkazano',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806' },
  confirmed: { bg: '#E1F5EE', color: '#085041' },
  completed: { bg: '#E6F1FB', color: '#0C447C' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F' },
}

export default function AdminDanPage() {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [selectedDate])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('reservations')
      .select('*, vehicles(name, category)')
      .neq('status', 'cancelled')
      .or(`pickup_date.eq.${selectedDate},return_date.eq.${selectedDate},and(pickup_date.lt.${selectedDate},return_date.gt.${selectedDate})`)
      .order('pickup_time', { ascending: true })

    setReservations(data || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('reservations').update({ status }).eq('id', id)
    fetchData()
  }

  const pickups = reservations.filter(r => r.pickup_date === selectedDate)
  const returns = reservations.filter(r => r.return_date === selectedDate)
  const active = reservations.filter(r => r.pickup_date < selectedDate && r.return_date > selectedDate)

const totalRevenue = reservations
  .filter(r => r.pickup_date === selectedDate)
  .reduce((s, r) => s + (r.total_price || 0), 0)

  function formatTime(t: string | null) {
    if (!t) return '10:00'
    return t.slice(0, 5)
  }

  function isToday() { return selectedDate === today }
  function isFuture() { return selectedDate > today }

  function prevDay() {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function nextDay() {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const metric = { background: '#f3f4f6', borderRadius: 8, padding: 16 }

  const ReservationCard = ({ r, type }: { r: Reservation; type: 'pickup' | 'return' | 'active' }) => {
    const st = STATUS_COLORS[r.status] || STATUS_COLORS.pending
    const timeLabel = type === 'pickup' ? formatTime(r.pickup_time) : type === 'return' ? formatTime(r.return_time) : null

    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', background: '#fff', borderLeft: `3px solid ${type === 'pickup' ? '#1D9E75' : type === 'return' ? '#185FA5' : '#BA7517'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{r.guest_name}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{r.guest_phone}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {timeLabel && (
              <div style={{ background: type === 'pickup' ? '#E1F5EE' : '#E6F1FB', color: type === 'pickup' ? '#085041' : '#0C447C', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                {timeLabel}
              </div>
            )}
            <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>
              {STATUS_LABELS[r.status]}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Vozilo</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{r.vehicles?.name || '—'}</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
              {type === 'pickup' ? 'Preuzimanje' : type === 'return' ? 'Vraćanje' : 'Period'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
              {type === 'active'
                ? `${r.pickup_date} – ${r.return_date}`
                : r.pickup_location}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</span>
            {r.agent_name && <span style={{ fontSize: 11, color: '#6b7280' }}>· {r.agent_name}</span>}
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75' }}>{r.total_price}€</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {r.status === 'pending' && (
              <button onClick={() => updateStatus(r.id, 'confirmed')} style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #5DCAA5', borderRadius: 6, background: 'transparent', color: '#0F6E56', cursor: 'pointer', fontWeight: 500 }}>
                Potvrdi
              </button>
            )}
            {r.status === 'confirmed' && type === 'return' && (
              <button onClick={() => updateStatus(r.id, 'completed')} style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #85B7EB', borderRadius: 6, background: 'transparent', color: '#185FA5', cursor: 'pointer', fontWeight: 500 }}>
                Vozilo vraćeno
              </button>
            )}
            {r.status === 'confirmed' && type === 'pickup' && (
              <button onClick={() => updateStatus(r.id, 'confirmed')} style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #5DCAA5', borderRadius: 6, background: '#E1F5EE', color: '#0F6E56', cursor: 'pointer', fontWeight: 500 }}>
                ✓ Preuzeto
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header sa navigacijom datuma */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Dnevni pregled</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' }}>
            {formatDate(selectedDate)}
            {isToday() && <span style={{ marginLeft: 8, background: '#E1F5EE', color: '#0F6E56', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Danas</span>}
            {isFuture() && <span style={{ marginLeft: 8, background: '#E6F1FB', color: '#0C447C', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Predstojeći</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={prevDay} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>←</button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#111', background: '#fff' }}
          />
          <button onClick={() => setSelectedDate(today)} style={{ padding: '8px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>
          <button onClick={nextDay} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>→</button>
        </div>
      </div>

      {/* Metrike */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 28 }}>
        <div style={metric}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Preuzimanja</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1D9E75' }}>{pickups.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>vozila se izdaje</div>
        </div>
        <div style={metric}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Vraćanja</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#185FA5' }}>{returns.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>vozila se vraća</div>
        </div>
        <div style={metric}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Aktivne rezervacije</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#BA7517' }}>{active.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>u toku tog dana</div>
        </div>
        <div style={metric}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Prihod (preuzimanja)</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111' }}>{totalRevenue}€</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>od novih rezervacija</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
      ) : reservations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 14, border: '1px dashed #e5e7eb', borderRadius: 12 }}>
          Nema rezervacija za ovaj dan.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Preuzimanja */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1D9E75' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Preuzimanja danas</div>
              <div style={{ background: '#E1F5EE', color: '#085041', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pickups.length}</div>
            </div>
            {pickups.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema preuzimanja</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pickups.sort((a, b) => (a.pickup_time || '').localeCompare(b.pickup_time || '')).map(r => (
                  <ReservationCard key={r.id} r={r} type="pickup" />
                ))}
              </div>
            )}
          </div>

          {/* Vraćanja */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#185FA5' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Vraćanja danas</div>
              <div style={{ background: '#E6F1FB', color: '#0C447C', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{returns.length}</div>
            </div>
            {returns.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>Nema vraćanja</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {returns.sort((a, b) => (a.return_time || '').localeCompare(b.return_time || '')).map(r => (
                  <ReservationCard key={r.id} r={r} type="return" />
                ))}
              </div>
            )}
          </div>

          {/* Aktivne rezervacije (vozila u toku) */}
          {active.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#BA7517' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Vozila u najmu</div>
                <div style={{ background: '#FAEEDA', color: '#633806', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{active.length}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {active.map(r => (
                  <ReservationCard key={r.id} r={r} type="active" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
