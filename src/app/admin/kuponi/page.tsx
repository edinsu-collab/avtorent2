'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Coupon = {
  id: string; code: string; discount_percent: number
  max_uses: number | null; used_count: number
  valid_from: string; valid_until: string | null; is_active: boolean; created_at: string
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function AdminKuponiPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', discount_percent: '10', max_uses: '', valid_until: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(data || [])
    setLoading(false)
  }

  async function save() {
    if (!form.code || !form.discount_percent) return
    setSaving(true)
    await supabase.from('coupons').insert({
      code: form.code.toUpperCase(),
      discount_percent: parseFloat(form.discount_percent),
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_until: form.valid_until || null,
      is_active: true,
      used_count: 0,
    })
    setSaving(false); setShowForm(false); setForm({ code: '', discount_percent: '10', max_uses: '', valid_until: '' }); fetchData()
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('coupons').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Kupon kodovi</h1>
        <button onClick={() => { setForm({ code: generateCode(), discount_percent: '10', max_uses: '', valid_until: '' }); setShowForm(true) }} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Generiši kupon
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 300px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Kod', 'Popust', 'Iskorištenost', 'Važi do', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#1D9E75', letterSpacing: 1 }}>{c.code}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111' }}>{c.discount_percent}%</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280' }}>
                      {c.used_count}{c.max_uses !== null ? ` / ${c.max_uses}` : ' / ∞'}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: 12 }}>{c.valid_until || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <button onClick={() => toggleActive(c.id, c.is_active)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 500, background: c.is_active ? '#E1F5EE' : '#f3f4f6', color: c.is_active ? '#085041' : '#9ca3af' }}>
                        {c.is_active ? 'Aktivan' : 'Neaktivan'}
                      </button>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <button
                        onClick={() => navigator.clipboard.writeText(c.code)}
                        style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                      >
                        Kopiraj
                      </button>
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
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Novi kupon</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Kod kupona</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                <button type="button" onClick={() => setForm(f => ({ ...f, code: generateCode() }))} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontSize: 12, color: '#374151' }}>↻</button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}><label style={lbl}>Popust (%)</label><input style={inp} type="number" min="1" max="100" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Maks. broj upotreba (prazno = neograničeno)</label><input style={inp} type="number" min="1" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="npr. 10" /></div>
            <div style={{ marginBottom: 20 }}><label style={lbl}>Važi do (prazno = neograničeno)</label><input style={inp} type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>

            <button onClick={save} disabled={saving} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Kreiranje...' : 'Kreiraj kupon'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
