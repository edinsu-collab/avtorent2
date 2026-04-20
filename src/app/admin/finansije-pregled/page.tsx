'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type AgentSummary = {
  name: string
  cashFromReservations: number
  otherIncome: number
  expenses: number
  safeDeposits: number
  pendingReceive: number
  balance: number
}

export default function AdminFinansijePregledPage() {
  const [summaries, setSummaries] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: agents }, { data: collections }, { data: transactions }] = await Promise.all([
      supabase.from('agents').select('full_name').eq('is_active', true),
      supabase.from('agent_collections').select('agent_name, cash_amount').gt('cash_amount', 0),
      supabase.from('agent_transactions').select('*'),
    ])

    const result: AgentSummary[] = (agents || []).map(a => {
      const name = a.full_name
      const cashFromRes = (collections || []).filter((c: any) => c.agent_name === name).reduce((s: number, c: any) => s + (c.cash_amount || 0), 0)
      const agentTx = (transactions || []).filter((t: any) => t.agent_name === name)
      const otherIncome = agentTx.filter((t: any) => t.type === 'income' && t.transfer_status !== 'pending').reduce((s: number, t: any) => s + t.amount, 0)
      const expenses = agentTx.filter((t: any) => t.type === 'expense' && t.transfer_status !== 'pending').reduce((s: number, t: any) => s + t.amount, 0)
      const safeDeposits = agentTx.filter((t: any) => t.type === 'expense' && t.category === 'Predaja u sef').reduce((s: number, t: any) => s + t.amount, 0)
      const pendingReceive = agentTx.filter((t: any) => t.type === 'income' && t.transfer_status === 'pending').reduce((s: number, t: any) => s + t.amount, 0)
      const balance = cashFromRes + otherIncome - expenses
      return { name, cashFromReservations: cashFromRes, otherIncome, expenses, safeDeposits, pendingReceive, balance }
    })

    setSummaries(result)
    setLoading(false)
  }

  const totalBalance = summaries.reduce((s, a) => s + a.balance, 0)
  const totalSafe = summaries.reduce((s, a) => s + a.safeDeposits, 0)

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', marginBottom: 24 }}>Finansije agenata</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#E1F5EE', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ukupno keš kod agenata</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1D9E75' }}>{totalBalance.toFixed(2)}€</div>
        </div>
        <div style={{ background: '#E6F1FB', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Predato u sef</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#185FA5' }}>{totalSafe.toFixed(2)}€</div>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 10, padding: '16px' }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Broj agenata</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#374151' }}>{summaries.length}</div>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Agent', 'Keš od rezervacija', 'Ostali prihodi', 'Rashodi', 'Predato u sef', 'Čeka prihvat.', 'Stanje'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map(a => (
                <tr key={a.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: '#111' }}>{a.name}</td>
                  <td style={{ padding: '12px 16px', color: '#1D9E75' }}>{a.cashFromReservations.toFixed(2)}€</td>
                  <td style={{ padding: '12px 16px', color: '#185FA5' }}>{a.otherIncome.toFixed(2)}€</td>
                  <td style={{ padding: '12px 16px', color: a.expenses > 0 ? '#dc2626' : '#9ca3af' }}>-{a.expenses.toFixed(2)}€</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{a.safeDeposits.toFixed(2)}€</td>
                  <td style={{ padding: '12px 16px' }}>
                    {a.pendingReceive > 0
                      ? <span style={{ fontSize: 11, background: '#FAEEDA', color: '#633806', padding: '3px 8px', borderRadius: 20 }}>{a.pendingReceive.toFixed(2)}€</span>
                      : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 15, color: a.balance >= 0 ? '#1D9E75' : '#dc2626' }}>
                    {a.balance.toFixed(2)}€
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
