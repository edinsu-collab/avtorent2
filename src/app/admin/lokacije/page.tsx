'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Location = { id: string; name: string; city: string; country: string; is_active: boolean; sort_order: number }
type Transfer = { id: string; from_location_id: string; to_location_id: string; price: number; is_active: boolean }

export default function AdminLokacijePage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', city: '', country: 'Crna Gora' })
  const [saving, setSaving] = useState(false)
  const [editingTransfer, setEditingTransfer] = useState<string | null>(null)
  const [transferPrice, setTransferPrice] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: l }, { data: t }] = await Promise.all([
      supabase.from('locations').select('*').order('sort_order'),
      supabase.from('location_transfers').select('*'),
    ])
    setLocations(l || [])
    setTransfers(t || [])
    setLoading(false)
  }

  async function saveLocation() {
    if (!form.name || !form.city) return
    setSaving(true)
    await supabase.from('locations').insert({ ...form, is_active: true, sort_order: locations.length + 1 })
    setSaving(false); setShowForm(false); setForm({ name: '', city: '', country: 'Crna Gora' }); fetchData()
  }

  async function toggleLocation(id: string, current: boolean) {
    await supabase.from('locations').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  async function saveTransferPrice(transferId: string) {
    await supabase.from('location_transfers').update({ price: parseFloat(transferPrice) }).eq('id', transferId)
    setEditingTransfer(null)
    fetchData()
  }

  function getTransfer(fromId: string, toId: string) {
    return transfers.find(t => t.from_location_id === fromId && t.to_location_id === toId)
  }

  function getLocationName(id: string) {
    return locations.find(l => l.id === id)?.name || '—'
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  const activeLocations = locations.filter(l => l.is_active)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Lokacije i transferi</h1>
        <button onClick={() => setShowForm(true)} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Dodaj lokaciju
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 300px' : '1fr', gap: 20, marginBottom: 24 }}>
        {/* Lista lokacija */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Lokacija', 'Grad', 'Zemlja', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500, color: '#111' }}>{l.name}</td>
                  <td style={{ padding: '12px 14px', color: '#6b7280' }}>{l.city}</td>
                  <td style={{ padding: '12px 14px', color: '#6b7280' }}>{l.country}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => toggleLocation(l.id, l.is_active)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 500, background: l.is_active ? '#E1F5EE' : '#f3f4f6', color: l.is_active ? '#085041' : '#9ca3af' }}>
                      {l.is_active ? 'Aktivna' : 'Neaktivna'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => { if (confirm(`Obrisati lokaciju ${l.name}?`)) supabase.from('locations').delete().eq('id', l.id).then(() => fetchData()) }} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                      Ukloni
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Forma */}
        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Nova lokacija</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Naziv *</label><input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Podgorica Aerodrom" /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Grad *</label><input style={inp} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Podgorica" /></div>
            <div style={{ marginBottom: 18 }}><label style={lbl}>Zemlja</label><input style={inp} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
            <button onClick={saveLocation} disabled={saving} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Snimanje...' : 'Dodaj lokaciju'}
            </button>
          </div>
        )}
      </div>

      {/* Matrica transfera */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>Cijene transfera</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>Naknada za preuzimanje na jednoj a vraćanje na drugoj lokaciji. Klikni na cijenu da je izmijeniš.</div>

        {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', textAlign: 'left', fontSize: 11, color: '#6b7280', minWidth: 140 }}>Od / Do</th>
                  {activeLocations.map(l => (
                    <th key={l.id} style={{ padding: '8px 10px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #f3f4f6', fontSize: 11, color: '#374151', fontWeight: 500, minWidth: 100, textAlign: 'center' }}>
                      {l.name.split(' ')[0]}<br/>{l.name.split(' ').slice(1).join(' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeLocations.map(from => (
                  <tr key={from.id}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e5e7eb', fontWeight: 500, color: '#374151', fontSize: 12 }}>{from.name}</td>
                    {activeLocations.map(to => {
                      if (from.id === to.id) return (
                        <td key={to.id} style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', background: '#f9fafb', textAlign: 'center', color: '#d1d5db' }}>—</td>
                      )
                      const transfer = getTransfer(from.id, to.id)
                      const isEditing = editingTransfer === (transfer?.id || `${from.id}-${to.id}`)
                      return (
                        <td key={to.id} style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6', textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="number" value={transferPrice} onChange={e => setTransferPrice(e.target.value)} style={{ width: 54, padding: '3px 6px', fontSize: 12, border: '1px solid #1D9E75', borderRadius: 4, textAlign: 'center' }} autoFocus />
                              <button onClick={() => transfer && saveTransferPrice(transfer.id)} style={{ fontSize: 11, padding: '3px 6px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✓</button>
                              <button onClick={() => setEditingTransfer(null)} style={{ fontSize: 11, padding: '3px 6px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingTransfer(transfer?.id || `${from.id}-${to.id}`); setTransferPrice(String(transfer?.price || 0)) }} style={{ background: transfer?.price ? '#E1F5EE' : '#f9fafb', color: transfer?.price ? '#085041' : '#9ca3af', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                              {transfer?.price ? `${transfer.price}€` : 'Dodaj'}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
