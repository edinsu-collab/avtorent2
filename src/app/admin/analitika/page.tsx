'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Stat = { id: string; name: string; qr_code: string; scans: number; conversions: number; revenue: number; commission: number }

export default function AdminAnalitikaPage() {
  const [stats, setStats] = useState<Stat[]>([])
  const [totals, setTotals] = useState({ scans: 0, conversions: 0, rate: 0, revenue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: partners }, { data: scans }, { data: reservations }] = await Promise.all([
      supabase.from('partners').select('id, name, qr_code').eq('is_active', true),
      supabase.from('qr_scans').select('partner_id, converted'),
      supabase.from('reservations').select('partner_id, total_price, commission_amount').neq('status', 'cancelled'),
    ])

    const enriched: Stat[] = (partners || []).map(p => {
      const pScans = (scans || []).filter((s: { partner_id: string }) => s.partner_id === p.id)
      const pRes = (reservations || []).filter((r: { partner_id: string }) => r.partner_id === p.id)
      return { id: p.id, name: p.name, qr_code: p.qr_code, scans: pScans.length, conversions: pRes.length, revenue: pRes.reduce((s: number, r: { total_price: number }) => s + (r.total_price || 0), 0), commission: pRes.reduce((s: number, r: { commission_amount: number }) => s + (r.commission_amount || 0), 0) }
    }).sort((a, b) => b.scans - a.scans)

    const ts = enriched.reduce((s, p) => s + p.scans, 0)
    const tc = enriched.reduce((s, p) => s + p.conversions, 0)
    setStats(enriched)
    setTotals({ scans: ts, conversions: tc, rate: ts > 0 ? (tc / ts) * 100 : 0, revenue: enriched.reduce((s, p) => s + p.revenue, 0) })
    setLoading(false)
  }

  const maxScans = Math.max(...stats.map(s => s.scans), 1)
  const metric = { background: '#f3f4f6', borderRadius: 8, padding: 16 }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 24 }}>QR analitika</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 28 }}>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ukupno skeniranja</div><div style={{ fontSize: 24, fontWeight: 600, color: '#111' }}>{totals.scans}</div></div>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Rezervacije (QR)</div><div style={{ fontSize: 24, fontWeight: 600, color: '#111' }}>{totals.conversions}</div></div>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Stopa konverzije</div><div style={{ fontSize: 24, fontWeight: 600, color: '#1D9E75' }}>{totals.rate.toFixed(1)}%</div></div>
        <div style={metric}><div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Prihod (QR kanali)</div><div style={{ fontSize: 24, fontWeight: 600, color: '#185FA5' }}>{totals.revenue.toFixed(0)}€</div></div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 14 }}>Skeniranja po partneru</div>
      {loading ? (
        <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
      ) : stats.length === 0 ? (
        <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>Nema podataka još.</div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#fff' }}>
          {stats.map(p => (
            <div key={p.id} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span><span style={{ fontWeight: 500, color: '#111' }}>{p.name}</span><span style={{ fontSize: 11, color: '#854F0B', background: '#FAEEDA', padding: '2px 6px', borderRadius: 20, marginLeft: 8, fontFamily: 'monospace' }}>{p.qr_code}</span></span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{p.scans} sken. · {p.conversions} rezerv. · {p.scans > 0 ? ((p.conversions / p.scans) * 100).toFixed(1) : 0}% · {p.revenue.toFixed(0)}€</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#f3f4f6' }}>
                <div style={{ height: '100%', width: `${(p.scans / maxScans) * 100}%`, background: '#1D9E75', borderRadius: 4 }} />
              </div>
              {p.conversions > 0 && (
                <div style={{ height: 4, borderRadius: 4, background: '#f3f4f6', marginTop: 3 }}>
                  <div style={{ height: '100%', width: `${(p.conversions / maxScans) * 100}%`, background: '#378ADD', borderRadius: 4 }} />
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 5, background: '#1D9E75', borderRadius: 2, marginRight: 5 }}/>Skeniranja</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 5, background: '#378ADD', borderRadius: 2, marginRight: 5 }}/>Rezervacije</span>
          </div>
        </div>
      )}
    </div>
  )
}
