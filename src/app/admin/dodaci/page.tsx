'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Extra = {
  id: string; name: string; name_en: string; name_de: string
  price: number; type: string; is_vehicle_specific: boolean
  is_active: boolean; sort_order: number
}

const TYPE_LABELS: Record<string, string> = {
  per_day: 'Po danu',
  fixed: 'Fiksno',
  vehicle_per_day: 'Po vozilu/danu (kasko)',
}

const empty = { name: '', name_en: '', name_de: '', price: '', type: 'per_day', is_vehicle_specific: false, sort_order: '0' }

export default function AdminDodaciPage() {
  const [extras, setExtras] = useState<Extra[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editExtra, setEditExtra] = useState<Extra | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('extras').select('*').order('sort_order')
    setExtras(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditExtra(null)
    setForm(empty)
    setShowForm(true)
  }

  function openEdit(e: Extra) {
    setEditExtra(e)
    setForm({ name: e.name, name_en: e.name_en || '', name_de: e.name_de || '', price: String(e.price), type: e.type, is_vehicle_specific: e.is_vehicle_specific, sort_order: String(e.sort_order) })
    setShowForm(true)
  }

  async function save() {
    if (!form.name || !form.price) return
    setSaving(true)
    const payload = { name: form.name, name_en: form.name_en, name_de: form.name_de, price: parseFloat(form.price), type: form.type, is_vehicle_specific: form.type === 'vehicle_per_day', sort_order: parseInt(form.sort_order) || 0 }
    if (editExtra) {
      await supabase.from('extras').update(payload).eq('id', editExtra.id)
    } else {
      await supabase.from('extras').insert({ ...payload, is_active: true })
    }
    setSaving(false); setShowForm(false); fetchData()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('extras').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Dodaci i oprema</h1>
        <button onClick={openAdd} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Dodaj</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 340px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Naziv', 'Tip obračuna', 'Cijena', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extras.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 500, color: '#111' }}>{e.name}</div>
                      {e.name_en && <div style={{ fontSize: 11, color: '#9ca3af' }}>{e.name_en}</div>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: e.type === 'fixed' ? '#E6F1FB' : e.type === 'vehicle_per_day' ? '#FAEEDA' : '#E1F5EE', color: e.type === 'fixed' ? '#0C447C' : e.type === 'vehicle_per_day' ? '#633806' : '#085041' }}>
                        {TYPE_LABELS[e.type]}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1D9E75' }}>{e.price}€</td>
                    <td style={{ padding: '11px 14px' }}>
                      <button onClick={() => toggleActive(e.id, e.is_active)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 500, background: e.is_active ? '#E1F5EE' : '#f3f4f6', color: e.is_active ? '#085041' : '#9ca3af' }}>
                        {e.is_active ? 'Aktivno' : 'Neaktivno'}
                      </button>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <button onClick={() => openEdit(e)} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>Uredi</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editExtra ? 'Uredi dodatak' : 'Novi dodatak'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}><label style={lbl}>Naziv (SR) *</label><input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kasko osiguranje" /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Naziv (EN)</label><input style={inp} value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} placeholder="Full coverage insurance" /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Naziv (DE)</label><input style={inp} value={form.name_de} onChange={e => setForm(f => ({ ...f, name_de: e.target.value }))} placeholder="Vollkaskoversicherung" /></div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Tip obračuna</label>
              <select style={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="per_day">Po danu</option>
                <option value="fixed">Fiksno (jednokratno)</option>
                <option value="vehicle_per_day">Po vozilu/danu (kasko)</option>
              </select>
              {form.type === 'vehicle_per_day' && (
                <div style={{ fontSize: 11, color: '#854F0B', background: '#FAEEDA', padding: '6px 10px', borderRadius: 6, marginTop: 6 }}>
                  Kasko cijenu možeš definisati posebno po vozilu u sekciji Vozila.
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div><label style={lbl}>Cijena (€) *</label><input style={inp} type="number" step="0.5" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="5.00" /></div>
              <div><label style={lbl}>Redosljed</label><input style={inp} type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
            </div>

            <button onClick={save} disabled={saving} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Snimanje...' : editExtra ? 'Sačuvaj' : 'Dodaj'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
