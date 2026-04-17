import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const pickupDate = searchParams.get('pickupDate')
  const returnDate = searchParams.get('returnDate')

  let query = supabase.from('vehicles').select('*').eq('is_available', true).order('price_per_day')
  if (category && category !== 'all') query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Greška' }, { status: 500 })

  if (pickupDate && returnDate && data) {
    const { data: bookedReservations } = await supabase
      .from('reservations')
      .select('vehicle_id')
      .in('status', ['pending', 'confirmed'])
      .lte('pickup_date', returnDate)
      .gte('return_date', pickupDate)

    const bookedIds = new Set((bookedReservations || []).map((r: { vehicle_id: string }) => r.vehicle_id))
    const available = data.filter((v: { id: string }) => !bookedIds.has(v.id))
    return NextResponse.json(available)
  }

  return NextResponse.json(data)
}