import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const { data: transfers } = await supabase
    .from('location_transfers')
    .select('*')
    .eq('is_active', true)

  return NextResponse.json({ locations: locations || [], transfers: transfers || [] })
}
