import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.json(null)

  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .single()

  if (!data) return NextResponse.json(null)

  // Provjeri max_uses
  if (data.max_uses !== null && data.used_count >= data.max_uses) {
    return NextResponse.json(null)
  }

  return NextResponse.json(data)
}
