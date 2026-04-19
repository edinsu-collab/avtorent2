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
  const locationId = searchParams.get('locationId')

  let query = supabase
    .from('vehicles')
    .select('*, vehicle_locations(location_id, locations(name, city))')
    .eq('is_available', true)
    .order('price_per_day')

  if (category && category !== 'all') query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Greška' }, { status: 500 })

  let vehicles = data || []

  // Filtriraj po lokaciji ako je odabrana
  if (locationId) {
    vehicles = vehicles.filter((v: any) =>
      (v.vehicle_locations || []).some((vl: any) => vl.location_id === locationId)
    )
  }

  // Filtriraj zauzeta vozila
  if (pickupDate && returnDate && vehicles.length > 0) {
    const { data: booked } = await supabase
      .from('reservations')
      .select('vehicle_id')
      .in('status', ['pending', 'confirmed'])
      .lte('pickup_date', returnDate)
      .gte('return_date', pickupDate)

    const bookedIds = new Set((booked || []).map((r: any) => r.vehicle_id))
    vehicles = vehicles.filter((v: any) => !bookedIds.has(v.id))
  }

  const targetDate = pickupDate || new Date().toISOString().split('T')[0]
  const priced = await applyPricing(supabase, vehicles, targetDate)
  return NextResponse.json(priced)
}

async function applyPricing(supabase: any, vehicles: any[], date: string) {
  const { data: seasons } = await supabase
    .from('seasonal_pricing')
    .select('*')
    .eq('is_active', true)
    .lte('date_from', date)
    .gte('date_to', date)

  const { data: dynamics } = await supabase
    .from('dynamic_pricing')
    .select('*')
    .eq('is_active', true)
    .order('occupancy_threshold', { ascending: false })

  let dynamicMultiplier = 1
  if (dynamics && dynamics.length > 0) {
    const { data: booked } = await supabase
      .from('reservations')
      .select('vehicle_id')
      .in('status', ['pending', 'confirmed'])
      .lte('pickup_date', date)
      .gte('return_date', date)

    const { data: total } = await supabase.from('vehicles').select('id').eq('is_available', true)
    const bookedCount = new Set((booked || []).map((r: any) => r.vehicle_id)).size
    const totalCount = (total || []).length
    const occupancyRate = totalCount > 0 ? (bookedCount / totalCount) * 100 : 0
    const applicable = dynamics.filter((d: any) => occupancyRate >= d.occupancy_threshold)
    if (applicable.length > 0) dynamicMultiplier = 1 + (applicable[0].price_increase_percent / 100)
  }

  const activeSeason = seasons && seasons.length > 0 ? seasons[0] : null
  const seasonMultiplier = activeSeason ? activeSeason.multiplier : 1

  return vehicles.map((v: any) => ({
    ...v,
    original_price: v.price_per_day,
    price_per_day: Math.round(v.price_per_day * seasonMultiplier * dynamicMultiplier),
    season_name: activeSeason?.name || null,
  }))
}
