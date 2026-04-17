'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Client = {
  id: string; email: string; full_name: string; phone: string
  nationality: string; client_type: string; notes: string; created_at: string
  reservation_count?: number; total_spent?: number
}

export default function AdminKlijentiPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', nationality: '', client_type: 'standard', notes: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: clientsData } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    const { data: reservations } = await supabase.from('reservations').select('guest_email, total_price').neq('status', 'cancelled')

    const enriched = (clientsData || []).map(c => {
      const cRes = (reservations || []).filter(r => r.guest_email === c.email)
      return { ...c, reservation_count: cRes.length, total_spent: cRes.reduce((s: number, r: { total_price: number }) => s + (r.total_price || 0), 0) }
    })
    setClients(enriched)
    setLoading(false)
  }

  function openEdit(c: Client) {
    setSelected(c)
    setEditForm({ full_name: c.full_name || '', phone: c.phone || '', nationality: c.nationality || '', client_type: c.client_type || 'standard', notes: c.notes || '' })
  }

  async function saveClient() {
    if (!selected) return
    setSaving(true)
    await supabase.from('clients').update(editForm).eq('id', selected.id)
    setSelected(s => s ? { ...s, ...editForm } : null)
    setSaving(false)
    fetchData()
  }

  const filtered = clients.filter(c => {
    if (filterType !== 'all' && c.client_type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)
    }
    return true
  })

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Klijenti</h1>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>{clients.length} klijenata ukupno</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: 220 }} placeholder="Pretraži po imenu, emailu..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="all">Svi klijenti</option>
          <option value="standard">Standardni</option>
          <option value="diaspora">Dijaspora</option>
        </select>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{filtered.length} rezultata</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Klijent', 'Tip', 'Rezervacije', 'Ukupno potrošeno', 'Član od', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', background: selected?.id === c.id ? '#f0fdf8' : 'transparent', cursor: 'pointer' }} onClick={() => openEdit(c)}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: c.client_type === 'diaspora' ? '#E6F1FB' : '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: c.client_type === 'diaspora' ? '#0C447C' : '#0F6E56', flexShrink: 0 }}>
                          {(c.full_name || c.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: '#111' }}>{c.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.email}</div>
                          {c.phone && <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {c.client_type === 'diaspora' ? (
                        <span style={{ fontSize: 11, background: '#E6F1FB', color: '#0C447C', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>Dijaspora</span>
                      ) : (
                        <span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '3px 8px', borderRadius: 20 }}>Standardni</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{c.reservation_count}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1D9E75' }}>{c.total_spent?.toFixed(0)}€</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#9ca3af' }}>{new Date(c.created_at).toLocaleDateString('sr-RS')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button onClick={e => { e.stopPropagation(); openEdit(c) }} style={{ padding: '4px 10px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>Uredi</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema klijenata.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{selected.full_name || selected.email}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{selected.email}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}><label style={lbl}>Ime i prezime</label><input style={inp} value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Telefon</label><input style={inp} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>Nacionalnost</label><input style={inp} value={editForm.nationality} onChange={e => setEditForm(f => ({ ...f, nationality: e.target.value }))} /></div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Tip klijenta</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['standard', 'Standardni', '#E1F5EE', '#085041'], ['diaspora', 'Dijaspora', '#E6F1FB', '#0C447C']].map(([val, label, bg, color]) => (
                  <button key={val} onClick={() => setEditForm(f => ({ ...f, client_type: val }))} style={{ padding: '8px', borderRadius: 8, border: `1px solid ${editForm.client_type === val ? color : '#e5e7eb'}`, background: editForm.client_type === val ? bg : '#fff', color: editForm.client_type === val ? color : '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: editForm.client_type === val ? 600 : 400 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Interna napomena</label>
              <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Napomena za internu upotrebu..." />
            </div>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#9ca3af' }}>Rezervacije</span>
                <span style={{ fontWeight: 600, color: '#111' }}>{selected.reservation_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9ca3af' }}>Ukupno potrošeno</span>
                <span style={{ fontWeight: 600, color: '#1D9E75' }}>{selected.total_spent?.toFixed(0)}€</span>
              </div>
            </div>

            <button onClick={saveClient} disabled={saving} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Snimanje...' : 'Sačuvaj izmjene'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
