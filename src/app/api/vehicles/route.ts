import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { searchParams } = new URL(req.url)
  const vehicleClass = searchParams.get('category')
  const pickupDate = searchParams.get('pickupDate')
  const returnDate = searchParams.get('returnDate')
  const targetDate = pickupDate || new Date().toISOString().split('T')[0]

  const [
    { data: fleetData },
    { data: categories },
    { data: seasons },
    { data: dynamics },
    { data: zauzeteRezData },
  ] = await Promise.all([
    supabase
      .from('vozila_fleet')
      .select('id, license_plate, marka, model, year, transmission, fuel_type, seats, image_url, vehicle_class, features, price_per_day, fleet_status, lokacija, show_on_site, price_category_id, agregirani_2')
      .eq('fleet_status', 'available')
      .eq('show_on_site', true)
      .order('marka'),
    supabase.from('price_categories').select('*').eq('is_active', true),
    supabase.from('seasonal_pricing').select('*').eq('is_active', true).lte('date_from', targetDate).gte('date_to', targetDate),
    supabase.from('dynamic_pricing').select('*').eq('is_active', true).order('occupancy_threshold', { ascending: false }),
    pickupDate && returnDate
      ? supabase.from('rezervacije').select('br_tablica').neq('daily_status', 'Nije izdato').lte('od_datuma', returnDate).gt('do_datuma', pickupDate)
      : Promise.resolve({ data: [] }),
  ])

  const fleet = fleetData || []
  if (fleet.length === 0) return NextResponse.json([])

  // Zauzetost za dynamic pricing
  const { data: zauzeteDanas } = await supabase
    .from('rezervacije')
    .select('br_tablica')
    .neq('daily_status', 'Nije izdato')
    .lte('od_datuma', targetDate)
    .gt('do_datuma', targetDate)

  const totalAvailable = fleet.length
  const zauzeteDanasSet = new Set((zauzeteDanas || []).map((r: any) => r.br_tablica))
  const zauzeteDanasCount = fleet.filter((v: any) => zauzeteDanasSet.has(v.license_plate)).length
  const occupancyRate = totalAvailable > 0 ? (zauzeteDanasCount / totalAvailable) * 100 : 0

  const activeSeason = (seasons || [])[0] || null
  const seasonMultiplier = activeSeason?.multiplier || 1
  const activeDynamics = (dynamics || []).filter((d: any) => d.is_active && occupancyRate >= d.occupancy_threshold)
  const dynamicMultiplier = activeDynamics.length > 0 ? 1 + activeDynamics[0].price_increase_percent / 100 : 1

  const zauzetePeriodSet = new Set(((zauzeteRezData as any) || []).map((r: any) => r.br_tablica))

  // Grupiši po marka+model+year — identično kao admin/vozila
  const groupMap = new Map<string, any>()

  for (const v of fleet) {
    if (pickupDate && returnDate && zauzetePeriodSet.has(v.license_plate)) continue

    const key = `${v.marka}__${v.model}__${v.year}`

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        _vehicles: [],
        marka: v.marka,
        model: v.model,
        year: v.year,
        transmission: v.transmission,
        fuel_type: v.fuel_type,
        seats: v.seats,
        image_url: v.image_url,
        vehicle_class: v.vehicle_class,
        features: v.features || [],
        price_per_day: v.price_per_day || 0,
        price_category_id: v.price_category_id,
        lokacija: v.lokacija,
      })
    }

    const g = groupMap.get(key)!
    g._vehicles.push(v)
    if (!g.image_url && v.image_url) g.image_url = v.image_url
    if (!g.vehicle_class && v.vehicle_class) g.vehicle_class = v.vehicle_class
    if ((!g.features || !g.features.length) && v.features?.length) g.features = v.features
    if (!g.seats && v.seats) g.seats = v.seats
  }

  // Filter po klasi
  let groups = Array.from(groupMap.entries())
  if (vehicleClass && vehicleClass !== 'all') {
    groups = groups.filter(([, g]) => g.vehicle_class === vehicleClass)
  }

  // Finalna cijena sa svim multiplikatorima
  const result = groups.map(([key, g]) => {
    const cat = (categories || []).find((c: any) => c.id === g.price_category_id)
    const catMultiplier = cat?.base_multiplier || 1
    const finalPrice = Math.round(g.price_per_day * catMultiplier * seasonMultiplier * dynamicMultiplier)
    const cleanName = `${g.marka} ${g.model} ${g.year || ''}`.trim()

    return {
      id: key,
      name: cleanName,
      category: g.vehicle_class || 'Hatchback',
      price_per_day: finalPrice,
      original_price: g.price_per_day,
      seats: g.seats || 5,
      transmission: g.transmission || 'manual',
      fuel_type: g.fuel_type || 'diesel',
      features: g.features || [],
      year: g.year,
      image_url: g.image_url,
      season_name: activeSeason?.name || null,
      category_name: cat?.name || null,
      slobodnih: g._vehicles.length,
      lokacija: g.lokacija,
      vehicle_locations: [],
    }
  })

  result.sort((a, b) => a.price_per_day - b.price_per_day)

  return NextResponse.json(result)
}
