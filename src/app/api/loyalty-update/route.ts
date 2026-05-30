import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getTier(spent: number): string {
  if (spent >= 2000) return 'gold'
  if (spent >= 500) return 'silver'
  return 'bronze'
}

export async function POST(req: NextRequest) {
  try {
    const { clientEmail } = await req.json()
    if (!clientEmail) return NextResponse.json({ error: 'email required' }, { status: 400 })

    // Izračunaj ukupno potrošeno iz zatvorenih/završenih rezervacija
    const { data: rez } = await supabase
      .from('reservations')
      .select('total_price, status')
      .eq('guest_email', clientEmail)
      .in('status', ['closed', 'completed', 'issued'])

    const totalSpent = (rez || []).reduce((sum, r) => sum + (r.total_price || 0), 0)
    const tier = getTier(totalSpent)
    const count = (rez || []).length

    // Ažuriraj klijenta
    await supabase.from('clients')
      .update({
        loyalty_tier: tier,
        loyalty_total_spent: totalSpent,
        loyalty_reservations_count: count,
      })
      .eq('email', clientEmail)

    return NextResponse.json({ success: true, tier, totalSpent, count })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
