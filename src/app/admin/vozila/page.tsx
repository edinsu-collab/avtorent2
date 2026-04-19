'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Vehicle = { id: string; name: string; category: string; price_per_day: number; seats: number; transmission: string; fuel_type: string; features: string[]; is_available: boolean; year: number; image_url: string | null; location_id: string | null }

const CAT: Record<string, string> = { economy: 'Ekonomična', suv: 'SUV', premium: 'Premium', minivan: 'Kombi', convertible: 'Kabriolet' }
const ICONS: Record<string, string> = { economy: '🚗', suv: '🚙', premium: '🏎️', minivan: '🚐', convertible: '🚘' }
const empty = { name: '', category: 'economy', price_per_day: '', seats: '5', transmission: 'manual', fuel_type: 'petrol', features: '', year: String(new Date().getFullYear()), is_available: true, image_url: '', location_id: '' }

export default function AdminVozilaPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [locationsList, setLocationsList] = useState<{id:string;name:string}[]>([])

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(d => setLocationsList(d.locations || []))
  }, [])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('vehicles').select('*').order('price_per_day')
    setVehicles(data || [])
    setLoading(false)
  }

  function openEdit(v: Vehicle) {
    setEditVehicle(v)
    setForm({ name: v.name, category: v.category, price_per_day: String(v.price_per_day), seats: String(v.seats), transmission: v.transmission, fuel_type: v.fuel_type, features: (v.features || []).join(', '), year: String(v.year || ''), is_available: v.is_available, image_url: v.image_url || '', location_id: v.location_id || '' })
    setShowForm(true)
  }

  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `vehicles/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('vehicle-images').upload(path, file, { upsert: true })
    if (error) { console.error(error); setUploading(false); return null }
    const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path)
    setUploading(false)
    return data.publicUrl
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file)
    if (url) setForm(f => ({ ...f, image_url: url }))
  }

  async function saveVehicle() {
    if (!form.name || !form.price_per_day) return
    setSaving(true)
    const payload = { name: form.name, category: form.category, price_per_day: parseFloat(form.price_per_day), seats: parseInt(form.seats), transmission: form.transmission, fuel_type: form.fuel_type, features: form.features.split(',').map(s => s.trim()).filter(Boolean), year: parseInt(form.year) || null, is_available: form.is_available, image_url: form.image_url || null, location_id: (form as any).location_id || null }
    if (editVehicle) { await supabase.from('vehicles').update(payload).eq('id', editVehicle.id) }
    else { await supabase.from('vehicles').insert(payload) }
    setSaving(false); setShowForm(false); fetchData()
  }

  async function toggleAvail(id: string, cur: boolean) {
    await supabase.from('vehicles').update({ is_available: !cur }).eq('id', id)
    fetchData()
  }

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Vozila</h1>
        <button onClick={() => { setEditVehicle(null); setForm(empty); setShowForm(true) }} style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Dodaj vozilo</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 340px' : '1fr', gap: 16 }}>
        {/* Vehicle grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, alignContent: 'start' }}>
          {loading ? <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : vehicles.map(v => (
            <div key={v.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              <div style={{ height: 140, background: '#f3f4f6', position: 'relative', overflow: 'hidden' }}>
                {v.image_url ? (
                  <img src={v.image_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                    {ICONS[v.category] || '🚗'}
                  </div>
                )}
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  <button onClick={() => toggleAvail(v.id, v.is_available)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 500, background: v.is_available ? '#E1F5EE' : '#FAEEDA', color: v.is_available ? '#085041' : '#633806' }}>
                    {v.is_available ? 'Dostupno' : 'Nedostupno'}
                  </button>
                </div>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111', marginBottom: 2 }}>{v.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{CAT[v.category]} · {v.year}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>{v.price_per_day}€<span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>/dan</span></span>
                  <button onClick={() => openEdit(v)} style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>Uredi</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff', alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{editVehicle ? 'Uredi vozilo' : 'Novo vozilo'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Slika */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Slika vozila</label>
              {form.image_url && (
                <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', height: 120, background: '#f3f4f6' }}>
                  <img src={form.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', border: '1px dashed #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#6b7280', background: '#f9fafb' }}>
                {uploading ? 'Uploaduje se...' : '+ Odaberi sliku'}
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} disabled={uploading} />
              </label>
              {form.image_url && (
                <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} style={{ marginTop: 4, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Ukloni sliku
                </button>
              )}
            </div>

            <div style={{ marginBottom: 12 }}><label style={lbl}>Naziv *</label><input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Volkswagen Golf" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={lbl}>Kategorija</label><select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option value="economy">Ekonomična</option><option value="suv">SUV</option><option value="premium">Premium</option><option value="minivan">Kombi</option><option value="convertible">Kabriolet</option></select></div>
              <div><label style={lbl}>Cijena/dan (€) *</label><input style={inp} type="number" value={form.price_per_day} onChange={e => setForm(f => ({ ...f, price_per_day: e.target.value }))} placeholder="70" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={lbl}>Transmisija</label><select style={inp} value={form.transmission} onChange={e => setForm(f => ({ ...f, transmission: e.target.value }))}><option value="manual">Manualni</option><option value="automatic">Automatik</option></select></div>
              <div><label style={lbl}>Mjesta</label><input style={inp} type="number" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={lbl}>Gorivo</label><select style={inp} value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}><option value="petrol">Benzin</option><option value="diesel">Dizel</option><option value="electric">Električno</option><option value="hybrid">Hibrid</option></select></div>
              <div><label style={lbl}>Godište</label><input style={inp} type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Bazna lokacija</label>
              <select style={inp} value={(form as any).location_id || ''} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                <option value="">-- Bez lokacije --</option>
                {locationsList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Oprema (zarezom)</label><input style={inp} value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} placeholder="Klima, GPS, Bluetooth" /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <input type="checkbox" id="avail" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
              <label htmlFor="avail" style={{ fontSize: 13, cursor: 'pointer', color: '#374151' }}>Vozilo je dostupno</label>
            </div>
            <button onClick={saveVehicle} disabled={saving || uploading} style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Snimanje...' : editVehicle ? 'Sačuvaj' : 'Dodaj vozilo'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
