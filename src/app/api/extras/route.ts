import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')

  const { data: extras } = await supabase
    .from('extras')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  let vehicleExtras: unknown[] = []
  if (vehicleId) {
    const { data } = await supabase
      .from('vehicle_extras')
      .select('*, extras(*)')
      .eq('vehicle_id', vehicleId)
    vehicleExtras = data || []
  }

  return NextResponse.json({ extras: extras || [], vehicleExtras })
}
