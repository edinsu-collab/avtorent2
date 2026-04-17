'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SeasonalPricing = {
  id: string; name: string; date_from: string; date_to: string
  multiplier: number; is_active: boolean
}

type DynamicPricing = {
  id: string; occupancy_threshold: number
  price_increase_percent: number; is_active: boolean
}

type Vehicle = { id: string; name: string; price_per_day: number; category: string }

const emptyForm = { name: '', date_from: '', date_to: '', multiplier: '1.00' }

export default function AdminCijenePage() {
  const [seasons, setSeasons] = useState<SeasonalPricing[]>([])
  const [dynamics, setDynamics] = useState<DynamicPricing[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editSeason, setEditSeason] = useState<SeasonalPricing | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().split('T')[0])
  const [occupancyRate, setOccupancyRate] = useState(0)

  useEffect(() => { fetchData() }, [])

  useEffect(() => { fetchOccupancy() }, [previewDate])

  async function fetchData() {
    const [{ data: s }, { data: d }, { data: v }] = await Promise.all([
      supabase.from('seasonal_pricing').select('*').order('date_from'),
      supabase.from('dynamic_pricing').select('*').order('occupancy_threshold'),
      supabase.from('vehicles').select('id, name, price_per_day, category').eq('is_available', true).order('price_per_day'),
    ])
    setSeasons(s || [])
    setDynamics(d || [])
    setVehicles(v || [])
    setLoading(false)
  }

  async function fetchOccupancy() {
    const { data } = await supabase
      .from('reservations')
      .select('vehicle_id')
      .in('status', ['pending', 'confirmed'])
      .lte('pickup_date', previewDate)
      .gte('return_date', previewDate)

    const { data: totalVehicles } = await supabase
      .from('vehicles')
      .select('id')
      .eq('is_available', true)

    const booked = new Set((data || []).map(r => r.vehicle_id)).size
    const total = (totalVehicles || []).length
    setOccupancyRate(total > 0 ? Math.round((booked / total) * 100) : 0)
  }

  function getSeasonForDate(date: string): SeasonalPricing | null {
    return seasons.find(s => s.is_active && date >= s.date_from && date <= s.date_to) || null
  }

  function getDynamicMultiplier(): number {
    if (!dynamics.some(d => d.is_active)) return 1
    const activeDynamics = dynamics.filter(d => d.is_active)
    const applicable = activeDynamics
      .filter(d => occupancyRate >= d.occupancy_threshold)
      .sort((a, b) => b.occupancy_threshold - a.occupancy_threshold)
    if (applicable.length === 0) return 1
    return 1 + (applicable[0].price_increase_percent / 100)
  }

  function getFinalPrice(basePrice: number, date: string): number {
    const season = getSeasonForDate(date)
    const seasonMultiplier = season ? season.multiplier : 1
    const dynamicMultiplier = getDynamicMultiplier()
    return Math.round(basePrice * seasonMultiplier * dynamicMultiplier)
  }

  async function saveSeason() {
    if (!form.name || !form.date_from || !form.date_to || !form.multiplier) return
    setSaving(true)
    const payload = { name: form.name, date_from: form.date_from, date_to: form.date_to, multiplier: parseFloat(form.multiplier), is_active: true }
    if (editSeason) {
      await supabase.from('seasonal_pricing').update(payload).eq('id', editSeason.id)
    } else {
      await supabase.from('seasonal_pricing').insert(payload)
    }
    setSaving(false); setShowForm(false); setForm(emptyForm); setEditSeason(null); fetchData()
  }

  async function toggleSeason(id: string, current: boolean) {
    await supabase.from('seasonal_pricing').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  async function deleteSeason(id: string) {
    if (!confirm('Obrisati ovaj period?')) return
    await supabase.from('seasonal_pricing').delete().eq('id', id)
    fetchData()
  }

  async function toggleDynamic(id: string, current: boolean) {
    await supabase.from('dynamic_pricing').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  async function updateDynamicPercent(id: string, percent: string) {
    await supabase.from('dynamic_pricing').update({ price_increase_percent: parseFloat(percent) }).eq('id', id)
    fetchData()
  }

  const dynamicActive = dynamics.some(d => d.is_active)
  const currentSeason = getSeasonForDate(previewDate)
  const dynamicMultiplier = getDynamicMultiplier()

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 24 }}>Upravljanje cijenama</h1>

      {/* Pregled cijena za datum */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 16 }}>Pregled cijena za datum</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>Datum</label>
            <input type="date" value={previewDate} onChange={e => setPreviewDate(e.target.value)} style={{ ...inp, width: 180 }} />
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 16px', fontSize: 13 }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 2 }}>Aktivna sezona</div>
            <div style={{ fontWeight: 600, color: currentSeason ? '#1D9E75' : '#9ca3af' }}>
              {currentSeason ? `${currentSeason.name} (×${currentSeason.multiplier})` : 'Nema aktivne sezone (×1.0)'}
            </div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 16px', fontSize: 13 }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 2 }}>Zauzetost flote</div>
            <div style={{ fontWeight: 600, color: occupancyRate >= 70 ? '#dc2626' : occupancyRate >= 40 ? '#BA7517' : '#1D9E75' }}>
              {occupancyRate}%
              {dynamicActive && dynamicMultiplier > 1 && <span style={{ color: '#BA7517', marginLeft: 6 }}>+{Math.round((dynamicMultiplier - 1) * 100)}%</span>}
            </div>
          </div>
        </div>

        {/* Tabela vozila sa cijenama */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Vozilo', 'Osnovna cijena', 'Sezonska cijena', 'Dinamička cijena', 'Finalna cijena'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => {
                const seasonPrice = currentSeason ? Math.round(v.price_per_day * currentSeason.multiplier) : v.price_per_day
                const finalPrice = getFinalPrice(v.price_per_day, previewDate)
                const hasChange = finalPrice !== v.price_per_day
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 500, color: '#111' }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.category}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#6b7280' }}>{v.price_per_day}€</td>
                    <td style={{ padding: '10px 14px', color: currentSeason ? '#1D9E75' : '#6b7280' }}>
                      {seasonPrice}€
                      {currentSeason && seasonPrice !== v.price_per_day && (
                        <span style={{ fontSize: 11, color: currentSeason.multiplier > 1 ? '#dc2626' : '#1D9E75', marginLeft: 4 }}>
                          ({currentSeason.multiplier > 1 ? '+' : ''}{Math.round((currentSeason.multiplier - 1) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: dynamicMultiplier > 1 ? '#BA7517' : '#6b7280' }}>
                      {dynamicActive && dynamicMultiplier > 1 ? `${finalPrice}€` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: hasChange ? '#dc2626' : '#1D9E75' }}>{finalPrice}€</span>
                      {hasChange && <div style={{ fontSize: 10, color: '#9ca3af' }}>osnova: {v.price_per_day}€</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Sezonske cijene */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Sezonski periodi</div>
            <button onClick={() => { setEditSeason(null); setForm(emptyForm); setShowForm(true) }}
              style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Dodaj period
            </button>
          </div>

          {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seasons.map(s => (
                <div key={s.id} style={{ border: `1px solid ${s.is_active ? '#5DCAA5' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px', background: s.is_active ? '#f0fdf8' : '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.date_from} — {s.date_to}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: s.multiplier > 1 ? '#dc2626' : s.multiplier < 1 ? '#1D9E75' : '#374151' }}>
                        ×{s.multiplier}
                      </span>
                      <button onClick={() => toggleSeason(s.id, s.is_active)}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 500, background: s.is_active ? '#E1F5EE' : '#f3f4f6', color: s.is_active ? '#085041' : '#9ca3af' }}>
                        {s.is_active ? 'Aktivan' : 'Neaktivan'}
                      </button>
                      <button onClick={() => { setEditSeason(s); setForm({ name: s.name, date_from: s.date_from, date_to: s.date_to, multiplier: String(s.multiplier) }); setShowForm(true) }}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
                        Uredi
                      </button>
                      <button onClick={() => deleteSeason(s.id)}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid #fecaca', background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Forma za dodavanje/editovanje */}
          {showForm && (
            <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#f9fafb' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 12 }}>{editSeason ? 'Uredi period' : 'Novi period'}</div>
              <div style={{ marginBottom: 10 }}><label style={lbl}>Naziv</label><input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Visoka sezona" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div><label style={lbl}>Od datuma</label><input type="date" style={inp} value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} /></div>
                <div><label style={lbl}>Do datuma</label><input type="date" style={inp} value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} /></div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Množitelj (1.0 = osnovna cijena)</label>
                <input type="number" step="0.05" min="0.1" max="3" style={inp} value={form.multiplier} onChange={e => setForm(f => ({ ...f, multiplier: e.target.value }))} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  Primjer: 1.5 = +50% · 0.7 = -30% · 1.0 = bez promjene
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveSeason} disabled={saving}
                  style={{ flex: 1, padding: '8px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? '...' : editSeason ? 'Sačuvaj' : 'Dodaj'}
                </button>
                <button onClick={() => { setShowForm(false); setForm(emptyForm); setEditSeason(null) }}
                  style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                  Odustani
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dinamičke cijene */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Dinamičke cijene</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{dynamicActive ? 'Uključeno' : 'Isključeno'}</span>
              <div
                onClick={async () => {
  const newState = !dynamicActive
  await Promise.all(dynamics.map(d => 
    supabase.from('dynamic_pricing').update({ is_active: newState }).eq('id', d.id)
  ))
  fetchData()
}}
                style={{ width: 40, height: 22, borderRadius: 11, background: dynamicActive ? '#1D9E75' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: dynamicActive ? 20 : 2, transition: 'left .2s' }} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
            Automatski povećava cijenu na osnovu zauzetosti flote
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dynamics.map(d => (
              <div key={d.id} style={{ border: `1px solid ${dynamicActive ? '#e5e7eb' : '#f3f4f6'}`, borderRadius: 8, padding: '12px 14px', background: dynamicActive ? '#fff' : '#f9fafb', opacity: dynamicActive ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                      Zauzetost ≥ <strong>{d.occupancy_threshold}%</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {occupancyRate >= d.occupancy_threshold && dynamicActive
                        ? <span style={{ color: '#BA7517', fontWeight: 500 }}>● Aktivan prag</span>
                        : 'Nije dostignut prag'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>+</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={d.price_increase_percent}
                      onChange={e => updateDynamicPercent(d.id, e.target.value)}
                      style={{ width: 56, padding: '4px 8px', fontSize: 13, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'center', color: '#dc2626' }}
                    />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dynamicActive && (
            <div style={{ marginTop: 14, background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#633806' }}>
              Trenutna zauzetost: <strong>{occupancyRate}%</strong>
              {dynamicMultiplier > 1 && <span style={{ marginLeft: 8 }}>→ Cijena uvećana za <strong>{Math.round((dynamicMultiplier - 1) * 100)}%</strong></span>}
              {dynamicMultiplier === 1 && <span style={{ marginLeft: 8, color: '#9ca3af' }}>→ Nema uvećanja</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
