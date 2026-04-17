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

  // Filtriraj zauzeta vozila
  if (pickupDate && returnDate && data) {
    const { data: booked } = await supabase
      .from('reservations')
      .select('vehicle_id')
      .in('status', ['pending', 'confirmed'])
      .lte('pickup_date', returnDate)
      .gte('return_date', pickupDate)

    const bookedIds = new Set((booked || []).map((r: { vehicle_id: string }) => r.vehicle_id))
    const available = data.filter((v: { id: string }) => !bookedIds.has(v.id))

    // Primijeni cijene
    const pricedVehicles = await applyPricing(supabase, available, pickupDate)
    return NextResponse.json(pricedVehicles)
  }

  // Primijeni cijene i bez filtriranja datuma
  const targetDate = pickupDate || new Date().toISOString().split('T')[0]
  const pricedVehicles = await applyPricing(supabase, data || [], targetDate)
  return NextResponse.json(pricedVehicles)
}

async function applyPricing(supabase: any, vehicles: any[], date: string) {
  // Dohvati aktivne sezone
  const { data: seasons } = await supabase
    .from('seasonal_pricing')
    .select('*')
    .eq('is_active', true)
    .lte('date_from', date)
    .gte('date_to', date)

  // Dohvati dinamičke pragove
  const { data: dynamics } = await supabase
    .from('dynamic_pricing')
    .select('*')
    .eq('is_active', true)
    .order('occupancy_threshold', { ascending: false })

  // Izračunaj zauzetost
  let dynamicMultiplier = 1
  if (dynamics && dynamics.length > 0) {
    const { data: booked } = await supabase
      .from('reservations')
      .select('vehicle_id')
      .in('status', ['pending', 'confirmed'])
      .lte('pickup_date', date)
      .gte('return_date', date)

    const { data: total } = await supabase
      .from('vehicles')
      .select('id')
      .eq('is_available', true)

    const bookedCount = new Set((booked || []).map((r: any) => r.vehicle_id)).size
    const totalCount = (total || []).length
    const occupancyRate = totalCount > 0 ? (bookedCount / totalCount) * 100 : 0

    const applicable = dynamics.filter((d: any) => occupancyRate >= d.occupancy_threshold)
    if (applicable.length > 0) {
      dynamicMultiplier = 1 + (applicable[0].price_increase_percent / 100)
    }
  }

  // Primijeni množitelje na vozila
  const activeSeason = seasons && seasons.length > 0 ? seasons[0] : null
  const seasonMultiplier = activeSeason ? activeSeason.multiplier : 1

  return vehicles.map(v => ({
    ...v,
    original_price: v.price_per_day,
    price_per_day: Math.round(v.price_per_day * seasonMultiplier * dynamicMultiplier),
    season_name: activeSeason?.name || null,
    season_multiplier: seasonMultiplier,
    dynamic_multiplier: dynamicMultiplier,
  }))
}
