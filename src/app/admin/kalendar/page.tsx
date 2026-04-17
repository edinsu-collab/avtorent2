'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Vehicle = { id: string; name: string; category: string }
type Reservation = {
  id: string; ref_code: string; guest_name: string
  pickup_date: string; return_date: string; pickup_time: string; return_time: string
  status: string; vehicle_id: string
  vehicles: { name: string } | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: '#FAEEDA', text: '#633806', border: '#EF9F27' },
  confirmed: { bg: '#E1F5EE', text: '#085041', border: '#1D9E75' },
  completed: { bg: '#E6F1FB', text: '#0C447C', border: '#378ADD' },
  cancelled: { bg: '#f3f4f6', text: '#9ca3af', border: '#d1d5db' },
}

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isDateInRange(date: string, start: string, end: string) {
  return date >= start && date <= end
}

export default function AdminKalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'by-vehicle' | 'by-date'>('by-vehicle')
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [hoveredRes, setHoveredRes] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [year, month])

  async function fetchData() {
    setLoading(true)
    const startDate = dateStr(year, month, 1)
    const endDate = dateStr(year, month, getDaysInMonth(year, month))

    const [{ data: v }, { data: r }] = await Promise.all([
      supabase.from('vehicles').select('id, name, category').eq('is_available', true).order('name'),
      supabase.from('reservations').select('*, vehicles(name)')
        .neq('status', 'cancelled')
        .or(`pickup_date.lte.${endDate},return_date.gte.${startDate}`)
        .order('pickup_date'),
    ])

    setVehicles(v || [])
    setReservations(r || [])
    setLoading(false)
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date().toISOString().split('T')[0]

  // Prikaz po vozilu — svaki red je jedno vozilo, kolone su dani
  function renderByVehicle() {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', textAlign: 'left', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280', fontWeight: 500, minWidth: 140, position: 'sticky', left: 0, zIndex: 2 }}>
                Vozilo
              </th>
              {days.map(day => {
                const ds = dateStr(year, month, day)
                const isToday = ds === today
                const dayOfWeek = new Date(year, month, day).getDay()
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                return (
                  <th key={day} style={{ padding: '4px', textAlign: 'center', background: isToday ? '#E1F5EE' : '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #f3f4f6', minWidth: 32, color: isToday ? '#085041' : isWeekend ? '#9ca3af' : '#374151', fontWeight: isToday ? 700 : 400 }}>
                    <div style={{ fontSize: 10, color: isToday ? '#085041' : '#9ca3af' }}>{DAYS[dayOfWeek === 0 ? 6 : dayOfWeek - 1]}</div>
                    <div>{day}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => {
              const vRes = reservations.filter(r => r.vehicle_id === v.id)
              return (
                <tr key={v.id}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb', fontWeight: 500, color: '#111', fontSize: 12, background: '#fff', position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap' }}>
                    {v.name}
                  </td>
                  {days.map(day => {
                    const ds = dateStr(year, month, day)
                    const isToday = ds === today
                    const res = vRes.find(r => isDateInRange(ds, r.pickup_date, r.return_date))
                    const isStart = res && res.pickup_date === ds
                    const isEnd = res && res.return_date === ds
                    const sc = res ? STATUS_COLORS[res.status] : null
                    const isHovered = res && hoveredRes === res.id

                    return (
                      <td key={day}
                        onClick={() => res && setSelectedRes(res)}
                        onMouseEnter={() => res && setHoveredRes(res.id)}
                        onMouseLeave={() => setHoveredRes(null)}
                        style={{
                          padding: '2px 1px',
                          borderBottom: '1px solid #f3f4f6',
                          borderRight: '1px solid #f3f4f6',
                          background: isToday ? '#f0fdf8' : '#fff',
                          cursor: res ? 'pointer' : 'default',
                          height: 36,
                        }}
                      >
                        {res && sc && (
                          <div style={{
                            height: 28,
                            background: isHovered ? sc.border : sc.bg,
                            borderTop: `2px solid ${sc.border}`,
                            borderBottom: `2px solid ${sc.border}`,
                            borderLeft: isStart ? `2px solid ${sc.border}` : 'none',
                            borderRight: isEnd ? `2px solid ${sc.border}` : 'none',
                            borderRadius: isStart && isEnd ? 4 : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background .1s',
                            overflow: 'hidden',
                          }}>
                            {isStart && (
                              <span style={{ fontSize: 10, color: isHovered ? '#fff' : sc.text, whiteSpace: 'nowrap', paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
                                {res.guest_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // Prikaz po datumu — klasični mjesečni kalendar
  function renderByDate() {
    const totalCells = firstDay + daysInMonth
    const totalRows = Math.ceil(totalCells / 7)

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#e5e7eb', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {DAYS.map(d => (
            <div key={d} style={{ background: '#f9fafb', padding: '8px 4px', textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>{d}</div>
          ))}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} style={{ background: '#fff', minHeight: 100 }} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const ds = dateStr(year, month, day)
            const isToday = ds === today
            const dayRes = reservations.filter(r => isDateInRange(ds, r.pickup_date, r.return_date))
            const pickups = reservations.filter(r => r.pickup_date === ds)
            const returns = reservations.filter(r => r.return_date === ds)

            return (
              <div key={day} style={{ background: isToday ? '#f0fdf8' : '#fff', minHeight: 100, padding: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#0F6E56' : '#374151', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#1D9E75' : 'transparent', color: isToday ? '#fff' : '#374151' }}>{day}</span>
                  {dayRes.length > 0 && (
                    <span style={{ fontSize: 10, background: '#E1F5EE', color: '#085041', padding: '1px 5px', borderRadius: 10 }}>{dayRes.length}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {pickups.map(r => {
                    const sc = STATUS_COLORS[r.status]
                    return (
                      <div key={`p-${r.id}`} onClick={() => setSelectedRes(r)} style={{ fontSize: 10, padding: '2px 5px', background: sc.bg, color: sc.text, borderRadius: 3, cursor: 'pointer', borderLeft: `2px solid ${sc.border}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ↑ {r.vehicles?.name?.split(' ').slice(-1)[0]} — {r.guest_name.split(' ')[0]}
                      </div>
                    )
                  })}
                  {returns.filter(r => r.pickup_date !== ds).map(r => {
                    const sc = STATUS_COLORS[r.status]
                    return (
                      <div key={`r-${r.id}`} onClick={() => setSelectedRes(r)} style={{ fontSize: 10, padding: '2px 5px', background: '#f3f4f6', color: '#6b7280', borderRadius: 3, cursor: 'pointer', borderLeft: '2px solid #d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ↓ {r.vehicles?.name?.split(' ').slice(-1)[0]} — {r.guest_name.split(' ')[0]}
                      </div>
                    )
                  })}
                  {dayRes.filter(r => r.pickup_date !== ds && r.return_date !== ds).slice(0, 2).map(r => {
                    const sc = STATUS_COLORS[r.status]
                    return (
                      <div key={`a-${r.id}`} onClick={() => setSelectedRes(r)} style={{ fontSize: 10, padding: '2px 5px', background: sc.bg, color: sc.text, borderRadius: 3, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        · {r.vehicles?.name?.split(' ').slice(-1)[0]}
                      </div>
                    )
                  })}
                  {dayRes.filter(r => r.pickup_date !== ds && r.return_date !== ds).length > 2 && (
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>+{dayRes.filter(r => r.pickup_date !== ds && r.return_date !== ds).length - 2} više</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Kalendar zauzetosti</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('by-vehicle')} style={{ padding: '7px 14px', fontSize: 12, border: 'none', background: view === 'by-vehicle' ? '#1D9E75' : '#fff', color: view === 'by-vehicle' ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: view === 'by-vehicle' ? 600 : 400 }}>Po vozilu</button>
            <button onClick={() => setView('by-date')} style={{ padding: '7px 14px', fontSize: 12, border: 'none', borderLeft: '1px solid #e5e7eb', background: view === 'by-date' ? '#1D9E75' : '#fff', color: view === 'by-date' ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: view === 'by-date' ? 600 : 400 }}>Po datumu</button>
          </div>
        </div>
      </div>

      {/* Navigacija mjesecom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>←</button>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#111', minWidth: 180, textAlign: 'center' }}>
          {MONTHS[month]} {year}
        </div>
        <button onClick={nextMonth} style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16, color: '#374151' }}>→</button>
        <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }} style={{ padding: '7px 14px', border: '1px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', cursor: 'pointer', fontSize: 12, color: '#0F6E56', fontWeight: 600 }}>Danas</button>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['pending', 'Na čekanju'], ['confirmed', 'Potvrđeno'], ['completed', 'Završeno']].map(([status, label]) => {
          const sc = STATUS_COLORS[status]
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: sc.bg, border: `1.5px solid ${sc.border}` }} />
              {label}
            </div>
          )
        })}
        {view === 'by-date' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <span>↑</span> Preuzimanje
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
              <span>↓</span> Vraćanje
            </div>
          </>
        )}
      </div>

      {/* Kalendar */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
        ) : view === 'by-vehicle' ? renderByVehicle() : renderByDate()}
      </div>

      {/* Detalji rezervacije (klik) */}
      {selectedRes && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 300, zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{selectedRes.guest_name}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{selectedRes.ref_code}</div>
            </div>
            <button onClick={() => setSelectedRes(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af', padding: 0 }}>✕</button>
          </div>
          {[
            ['Vozilo', selectedRes.vehicles?.name],
            ['Preuzimanje', `${selectedRes.pickup_date} u ${selectedRes.pickup_time?.slice(0,5) || '10:00'}`],
            ['Vraćanje', `${selectedRes.return_date} u ${selectedRes.return_time?.slice(0,5) || '10:00'}`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ color: '#9ca3af' }}>{l}</span>
              <span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <a href="/admin/rezervacije" style={{ fontSize: 12, color: '#1D9E75', textDecoration: 'none', fontWeight: 500 }}>
              Otvori rezervaciju →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
