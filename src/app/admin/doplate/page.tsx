'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SurchargeType = { id: string; name: string; is_active: boolean; sort_order: number }

export default function AdminDoplatePage() {
  const [types, setTypes] = useState<SurchargeType[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('surcharge_types').select('*').order('sort_order')
    setTypes(data || [])
    setLoading(false)
  }

  async function addType() {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('surcharge_types').insert({ name: newName.trim(), is_active: true, sort_order: types.length + 1 })
    setNewName('')
    setSaving(false)
    fetchData()
  }

  async function toggleType(id: string, current: boolean) {
    await supabase.from('surcharge_types').update({ is_active: !current }).eq('id', id)
    fetchData()
  }

  async function deleteType(id: string) {
    if (!confirm('Obrisati ovu stavku?')) return
    await supabase.from('surcharge_types').delete().eq('id', id)
    fetchData()
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 8 }}>Vrste doplata</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Stavke koje se pojavljuju pri zatvaranju rezervacije (gorivo, pranje, šteta...)</p>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', maxWidth: 480 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addType()}
            placeholder="Naziv doplate (npr. Gorivo)"
            style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111' }} />
          <button onClick={addType} disabled={saving || !newName.trim()}
            style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Dodaj
          </button>
        </div>

        {loading ? <div style={{ color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {types.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1px solid ${t.is_active ? '#e5e7eb' : '#f3f4f6'}`, borderRadius: 8, background: t.is_active ? '#fff' : '#f9fafb' }}>
                <span style={{ fontSize: 13, color: t.is_active ? '#111' : '#9ca3af', fontWeight: 500 }}>{t.name}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleType(t.id, t.is_active)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', background: t.is_active ? '#E1F5EE' : '#f3f4f6', color: t.is_active ? '#085041' : '#9ca3af', fontWeight: 500 }}>
                    {t.is_active ? 'Aktivna' : 'Neaktivna'}
                  </button>
                  <button onClick={() => deleteType(t.id)} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
