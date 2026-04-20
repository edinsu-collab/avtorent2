'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Transaction = {
  id: string; agent_name: string; type: string; category: string
  amount: number; comment: string | null; counterpart_agent: string | null
  transfer_status: string | null; license_plate: string | null
  created_at: string
  reservations?: { ref_code: string; guest_name: string } | null
}

type ExpenseCategory = { id: string; name: string; requires_plate: boolean; requires_description: boolean }
type Agent = { id: string; full_name: string; email: string }

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

const INCOME_CATEGORIES = [
  { key: 'car_installment', label: 'Naplata rate za prodato auto' },
  { key: 'old_debt', label: 'Naplata duga od ranije rezervacije' },
  { key: 'agent_transfer', label: 'Primljeno od agenta' },
  { key: 'other_income', label: 'Ostali prihodi' },
]

export default function AdminFinansijePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [agentName, setAgentName] = useState('')
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Income form
  const [incomeCategory, setIncomeCategory] = useState('')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeComment, setIncomeComment] = useState('')
  const [incomeSenderAgent, setIncomeSenderAgent] = useState('')

  // Expense form
  const [expenseCategory, setExpenseCategory] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseComment, setExpenseComment] = useState('')
  const [expensePlate, setExpensePlate] = useState('')
  const [expenseTargetAgent, setExpenseTargetAgent] = useState('')

  useEffect(() => {
    const name = getCookie('avtorent-agent-name')
    setAgentName(name)
    if (name) fetchData(name)
  }, [])

  async function fetchData(name: string) {
    const [{ data: tx }, { data: ec }, { data: ag }, { data: collections }] = await Promise.all([
      supabase.from('agent_transactions').select('*, reservations(ref_code, guest_name)')
        .eq('agent_name', name).order('created_at', { ascending: false }),
      supabase.from('expense_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('agents').select('id, full_name, email').eq('is_active', true),
      supabase.from('agent_collections').select('cash_amount').eq('agent_name', name).gt('cash_amount', 0),
    ])

    // Dodaj keš od rezervacija kao transakcije za prikaz
    const reservationCash = (collections || []).reduce((s: number, c: any) => s + (c.cash_amount || 0), 0)

    setTransactions(tx || [])
    setExpenseCategories(ec || [])
    setAgents((ag || []).filter((a: Agent) => a.full_name !== name))
    setLoading(false)

    // Sačuvaj za prikaz
    setReservationCashTotal(reservationCash)
  }

  const [reservationCashTotal, setReservationCashTotal] = useState(0)

  async function addIncome() {
    if (!incomeCategory || !incomeAmount) return
    setSaving(true)
    await supabase.from('agent_transactions').insert({
      agent_name: agentName,
      type: 'income',
      category: incomeCategory,
      amount: parseFloat(incomeAmount),
      comment: incomeComment || null,
      counterpart_agent: incomeCategory === 'agent_transfer' ? incomeSenderAgent : null,
      transfer_status: incomeCategory === 'agent_transfer' ? 'accepted' : null,
    })
    setSaving(false)
    setShowIncomeForm(false)
    setIncomeCategory(''); setIncomeAmount(''); setIncomeComment(''); setIncomeSenderAgent('')
    fetchData(agentName)
  }

  async function addExpense() {
    if (!expenseCategory || !expenseAmount) return
    setSaving(true)

    const cat = expenseCategories.find(c => c.id === expenseCategory)
    const isAgentTransfer = cat?.name === 'Predaja novca agentu'
    const isSafe = cat?.name === 'Predaja u sef'

    await supabase.from('agent_transactions').insert({
      agent_name: agentName,
      type: 'expense',
      category: cat?.name || expenseCategory,
      amount: parseFloat(expenseAmount),
      comment: expenseComment || null,
      license_plate: expensePlate || null,
      counterpart_agent: isAgentTransfer ? expenseTargetAgent : null,
      transfer_status: isAgentTransfer ? 'pending' : null,
    })

    // Ako je predaja agentu, kreiraj pending prijem kod drugog agenta
    if (isAgentTransfer && expenseTargetAgent) {
      await supabase.from('agent_transactions').insert({
        agent_name: expenseTargetAgent,
        type: 'income',
        category: 'agent_transfer',
        amount: parseFloat(expenseAmount),
        comment: `Čeka prihvatanje — od: ${agentName}`,
        counterpart_agent: agentName,
        transfer_status: 'pending',
      })
    }

    setSaving(false)
    setShowExpenseForm(false)
    setExpenseCategory(''); setExpenseAmount(''); setExpenseComment(''); setExpensePlate(''); setExpenseTargetAgent('')
    fetchData(agentName)
  }

  async function acceptTransfer(id: string) {
    await supabase.from('agent_transactions').update({ transfer_status: 'accepted', comment: null }).eq('id', id)
    fetchData(agentName)
  }

  // Izračunaj stanje
  const cashFromReservations = reservationCashTotal
  const otherIncome = transactions.filter(t => t.type === 'income' && t.transfer_status !== 'pending').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const pendingTransfers = transactions.filter(t => t.type === 'income' && t.transfer_status === 'pending')
  const totalCash = cashFromReservations + otherIncome - expenses

  const selectedExpenseCat = expenseCategories.find(c => c.id === expenseCategory)
  const isAgentTransferExpense = selectedExpenseCat?.name === 'Predaja novca agentu'
  const isSafeExpense = selectedExpenseCat?.name === 'Predaja u sef'

  const inp = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111' }}>Finansije</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Keš stanje — {agentName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowExpenseForm(false); setShowIncomeForm(!showIncomeForm) }}
            style={{ padding: '8px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Prihod
          </button>
          <button onClick={() => { setShowIncomeForm(false); setShowExpenseForm(!showExpenseForm) }}
            style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            - Rashod
          </button>
        </div>
      </div>

      {/* Pending transferi — čekaju prihvatanje */}
      {pendingTransfers.length > 0 && (
        <div style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#633806', marginBottom: 12 }}>Čeka prihvatanje</div>
          {pendingTransfers.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>Agent {t.counterpart_agent} šalje vam novac</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(t.created_at).toLocaleDateString('sr-RS')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1D9E75' }}>{t.amount.toFixed(2)}€</span>
                <button onClick={() => acceptTransfer(t.id)}
                  style={{ padding: '6px 14px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Prihvati
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: showIncomeForm || showExpenseForm ? '1fr 320px' : '1fr', gap: 20 }}>
        <div>
          {/* Stanje */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#E1F5EE', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Keš od rezervacija</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>{cashFromReservations.toFixed(2)}€</div>
            </div>
            <div style={{ background: '#E6F1FB', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Ostali prihodi</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#185FA5' }}>{otherIncome.toFixed(2)}€</div>
            </div>
            <div style={{ background: expenses > 0 ? '#FCEBEB' : '#f3f4f6', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Rashodi</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: expenses > 0 ? '#dc2626' : '#9ca3af' }}>-{expenses.toFixed(2)}€</div>
            </div>
          </div>

          {/* Ukupno stanje */}
          <div style={{ background: totalCash >= 0 ? '#f0fdf8' : '#fef2f2', border: `1px solid ${totalCash >= 0 ? '#5DCAA5' : '#fecaca'}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Trenutno keš stanje</div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>Keš koji imate kod sebe</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: totalCash >= 0 ? '#1D9E75' : '#dc2626' }}>
              {totalCash.toFixed(2)}€
            </div>
          </div>

          {/* Lista transakcija */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontSize: 14, fontWeight: 600, color: '#111' }}>
              Istorija transakcija
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Učitavanje...</div>
            ) : transactions.filter(t => t.transfer_status !== 'pending').length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nema transakcija</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Datum', 'Kategorija', 'Komentar', 'Iznos'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.filter(t => t.transfer_status !== 'pending').map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: 12 }}>
                        {new Date(t.created_at).toLocaleDateString('sr-RS')}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 500, color: '#111' }}>{t.category}</div>
                        {t.counterpart_agent && <div style={{ fontSize: 11, color: '#9ca3af' }}>Agent: {t.counterpart_agent}</div>}
                        {t.license_plate && <div style={{ fontSize: 11, color: '#9ca3af' }}>Tablice: {t.license_plate}</div>}
                        {t.reservations && <div style={{ fontSize: 11, color: '#9ca3af' }}>{t.reservations.ref_code} — {t.reservations.guest_name}</div>}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{t.comment || '—'}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: t.type === 'income' ? '#1D9E75' : '#dc2626', textAlign: 'right' }}>
                        {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}€
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Forma za prihod */}
        {showIncomeForm && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Dodaj prihod</div>
              <button onClick={() => setShowIncomeForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Kategorija *</label>
              <select style={inp} value={incomeCategory} onChange={e => setIncomeCategory(e.target.value)}>
                <option value="">-- Odaberi --</option>
                {INCOME_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>

            {incomeCategory === 'agent_transfer' && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Agent koji šalje novac *</label>
                <select style={inp} value={incomeSenderAgent} onChange={e => setIncomeSenderAgent(e.target.value)}>
                  <option value="">-- Odaberi agenta --</option>
                  {agents.map(a => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Iznos (€) *</label>
              <input style={inp} type="number" step="0.01" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="0.00" />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Komentar *</label>
              <textarea value={incomeComment} onChange={e => setIncomeComment(e.target.value)}
                placeholder="Obavezan komentar..."
                style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} />
            </div>

            <button onClick={addIncome} disabled={saving || !incomeCategory || !incomeAmount || !incomeComment}
              style={{ width: '100%', padding: 10, background: saving ? '#5DCAA5' : '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? '...' : 'Dodaj prihod'}
            </button>
          </div>
        )}

        {/* Forma za rashod */}
        {showExpenseForm && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Dodaj rashod</div>
              <button onClick={() => setShowExpenseForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Kategorija *</label>
              <select style={inp} value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>
                <option value="">-- Odaberi --</option>
                {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {isAgentTransferExpense && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Predaješ novac agentu *</label>
                <select style={inp} value={expenseTargetAgent} onChange={e => setExpenseTargetAgent(e.target.value)}>
                  <option value="">-- Odaberi agenta --</option>
                  {agents.map(a => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                </select>
                <div style={{ fontSize: 11, color: '#BA7517', marginTop: 4, padding: '6px 10px', background: '#FAEEDA', borderRadius: 6 }}>
                  Agent će dobiti obavještenje i mora prihvatiti prijem.
                </div>
              </div>
            )}

            {isSafeExpense && (
              <div style={{ background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#0C447C' }}>
                Novac predajete u sef. Unesite iznos koji stavljate u kovertu.
              </div>
            )}

            {selectedExpenseCat?.requires_plate && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Broj tablica *</label>
                <input style={inp} value={expensePlate} onChange={e => setExpensePlate(e.target.value)} placeholder="npr. PG-123-AB" />
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Iznos (€) *</label>
              <input style={inp} type="number" step="0.01" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="0.00" />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>{selectedExpenseCat?.requires_description ? 'Opis *' : 'Komentar'}</label>
              <textarea value={expenseComment} onChange={e => setExpenseComment(e.target.value)}
                placeholder={selectedExpenseCat?.requires_description ? 'Obavezan opis...' : 'Opcioni komentar...'}
                style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} />
            </div>

            <button
              onClick={addExpense}
              disabled={saving || !expenseCategory || !expenseAmount || (isAgentTransferExpense && !expenseTargetAgent) || (selectedExpenseCat?.requires_plate && !expensePlate) || (selectedExpenseCat?.requires_description && !expenseComment)}
              style={{ width: '100%', padding: 10, background: saving ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? '...' : 'Dodaj rashod'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
