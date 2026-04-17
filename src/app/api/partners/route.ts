import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { searchParams } = new URL(req.url)
  const qrCode = searchParams.get('qr')
  if (!qrCode) return NextResponse.json(null)

  const { data } = await supabase
    .from('partners')
    .select('id, name, commission_percent, client_discount_percent, qr_code')
    .eq('qr_code', qrCode)
    .eq('is_active', true)
    .single()

  if (data) {
    await supabase.from('qr_scans').insert({ partner_id: data.id, qr_code: qrCode, converted: false })
  }

  return NextResponse.json(data || null)
}
