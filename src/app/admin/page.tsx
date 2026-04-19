'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Collection = {
  id: string; reservation_id: string; agent_name: string; amount: number
  collection_type: string; payment_method: string
  cash_amount: number; card_amount: number; wire_amount: number
  note: string; created_at: string
  reservations?: { ref_code: string; guest_name: string; vehicles?: { name: string } }
}

type Reservation = {
  id: string; ref_code: string; guest_name: string; guest_phone: string
  pickup_date: string; return_date: string; pickup_time: string; return_time: string
  total_price: number; final_total: number | null; status: string; payment_status: string
  vehicles?: { name: string } | null
}

const CTYPE_LABELS: Record<string, string> = {
  rental: 'Najam', surcharge: 'Doplata', debt_collected: 'Naplata duga', prepaid_returned: 'Povrat pretplate'
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function AdminDashboardPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState<'today' | 'all'>('today')
  const agentName = getCookie('avtorent-agent-name')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchData() }, [selectedDate, viewMode])

  async function fetchData() {
    setLoading(true)

    // Zaduženja agenta
    let collectionsQuery = supabase
      .from('agent_collections')
      .select('*, reservations(ref_code, guest_name, vehicles(name))')
      .order('created_at', { ascending: false })

    if (agentName) collectionsQuery = collectionsQuery.eq('agent_name', agentName)

    if (viewMode === 'today') {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`
      collectionsQuery = collectionsQuery.gte('created_at', startOfDay).lte('created_at', endOfDay)
    }

    // Rezervacije
    const { data: res } = await supabase
      .from('reservations')
      .select('*, vehicles(name)')
      .neq('status', 'cancelled')
      .or(`pickup_date.eq.${today},return_date.eq.${today},and(pickup_date.lt.${today},return_date.gt.${today})`)
      .order('pickup_time')

    const { data: col } = await collectionsQuery

    setCollections(col || [])
    setReservations(res || [])
    setLoading(false)
  }

  // Metrike za danas
  const pickups = reservations.filter(r => r.pickup_date === today)
  const returns = reservations.filter(r => r.return_date === today)
  const active = reservations.filter(r => r.pickup_date < today && r.return_date > today)

  // Finansije
  const totalCash = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.cash_amount || 0), 0)
  const totalCard = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.card_amount || 0), 0)
  const totalWire = collections.filter(c => c.amount > 0).reduce((s, c) => s + (c.wire_amount || 0), 0)
  const totalReturned = collections.filter(c => c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0)
  const totalCollected = totalCash + totalCard + totalWire
  const netTotal = totalCollected - totalReturned

  const upcoming = reservations
    .filter(r => r.pickup_date > today && r.status === 'confirmed')
    .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date))
    .slice(0, 5)

  const ST_COLORS: Record<string, string> = {
    confirmed: '#1D9E75', issued: '#185FA5', closed: '#6b7280', pending: '#BA7517'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Dobrodošli{agentName ? `, ${agentName}` : ''}!</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Pregled za danas — {new Date().toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <a href="/admin/dan" style={{ padding: '8px 16px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', fontSize: 13, fontWeight: 600, color: '#085041', textDecoration: 'none' }}>
          Dnevni pregled →
        </a>
      </div>

      {/* Metrike dana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Preuzimanja danas', value: pickups.length, sub: 'vozila idu van', color: '#1D9E75', bg: '#E1F5EE' },
          { label: 'Vraćanja danas', value: returns.length, sub: 'vozila dolaze', color: '#185FA5', bg: '#E6F1FB' },
          { label: 'Aktivni najam', value: active.length, sub: 'vozila trenutno vani', color: '#BA7517', bg: '#FAEEDA' },
          { label: 'Ukupno naplaćeno', value: `${netTotal.toFixed(0)}€`, sub: viewMode === 'today' ? 'danas' : 'sve', color: '#111', bg: '#f3f4f6' },
        ].map(m => (
          <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '16px' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Zaduženja agenta */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Moja zaduženja</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setViewMode('today')} style={{ padding: '5px 12px', fontSize: 11, border: `1px solid ${viewMode === 'today' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: viewMode === 'today' ? '#E1F5EE' : '#fff', color: viewMode === 'today' ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: viewMode === 'today' ? 600 : 400 }}>
                Danas
              </button>
              <button onClick={() => setViewMode('all')} style={{ padding: '5px 12px', fontSize: 11, border: `1px solid ${viewMode === 'all' ? '#1D9E75' : '#e5e7eb'}`, borderRadius: 20, background: viewMode === 'all' ? '#E1F5EE' : '#fff', color: viewMode === 'all' ? '#085041' : '#6b7280', cursor: 'pointer', fontWeight: viewMode === 'all' ? 600 : 400 }}>
                Sve
              </button>
            </div>
          </div>

          {/* Sažetak po načinu plaćanja */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Keš', value: totalCash, color: '#1D9E75', bg: '#E1F5EE' },
              { label: 'Kartica', value: totalCard, color: '#185FA5', bg: '#E6F1FB' },
              { label: 'Virmanski', value: totalWire, color: '#BA7517', bg: '#FAEEDA' },
            ].map(m => (
              <div key={m.label} style={{ background: m.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value.toFixed(0)}€</div>
              </div>
            ))}
          </div>

          {totalReturned > 0 && (
            <div style={{ background: '#FCEBEB', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#791F1F' }}>
              Povrati: -{totalReturned.toFixed(2)}€
            </div>
          )}

          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Neto zaduženje</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{netTotal.toFixed(2)}€</span>
          </div>

          {/* Lista naplata */}
          {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : collections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>Nema naplata za odabrani period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {collections.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#111' }}>{c.reservations?.guest_name || '—'}</div>
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.reservations?.ref_code} · {CTYPE_LABELS[c.collection_type] || c.collection_type}</div>
                    {c.note && <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.note}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: c.amount >= 0 ? '#1D9E75' : '#dc2626' }}>{c.amount >= 0 ? '+' : ''}{c.amount.toFixed(2)}€</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>
                      {c.payment_method === 'split'
                        ? `K:${c.cash_amount}€ / C:${c.card_amount}€`
                        : c.payment_method === 'cash' ? 'Keš'
                        : c.payment_method === 'card' ? 'Kartica'
                        : c.payment_method === 'wire' ? 'Virmanski' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preuzimanja i vraćanja danas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preuzimanja */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D9E75' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Preuzimanja danas</div>
              <span style={{ fontSize: 12, background: '#E1F5EE', color: '#085041', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>{pickups.length}</span>
            </div>
            {pickups.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Nema preuzimanja danas</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pickups.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>{r.vehicles?.name} · {r.pickup_time?.slice(0,5)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: r.status === 'confirmed' ? '#E1F5EE' : '#E6F1FB', color: r.status === 'confirmed' ? '#085041' : '#0C447C', fontWeight: 500 }}>
                        {r.status === 'confirmed' ? 'Potvrđeno' : 'Izdato'}
                      </div>
                      <div style={{ color: '#1D9E75', fontWeight: 600, marginTop: 2 }}>{r.total_price}€</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vraćanja */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#185FA5' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Vraćanja danas</div>
              <span style={{ fontSize: 12, background: '#E6F1FB', color: '#0C447C', padding: '1px 8px', borderRadius: 20, fontWeight: 600 }}>{returns.length}</span>
            </div>
            {returns.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Nema vraćanja danas</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {returns.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f9fafb', borderRadius: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>{r.vehicles?.name} · {r.return_time?.slice(0,5)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: '#E6F1FB', color: '#0C447C', fontWeight: 500 }}>Vraćanje</div>
                      <div style={{ color: '#185FA5', fontWeight: 600, marginTop: 2 }}>{r.return_time?.slice(0,5)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nadolazeće rezervacije */}
      {upcoming.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 14 }}>Nadolazeće rezervacije</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Ref', 'Gost', 'Vozilo', 'Preuzimanje', 'Iznos'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcoming.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{r.ref_code}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 500, color: '#111' }}>{r.guest_name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{r.vehicles?.name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#374151' }}>
                    {new Date(r.pickup_date).toLocaleDateString('sr-RS', { day: 'numeric', month: 'short' })} u {r.pickup_time?.slice(0,5)}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75' }}>{r.total_price}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
