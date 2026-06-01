import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data } = await supabase
    .from('short_links')
    .select('url')
    .eq('code', code)
    .single()

  if (!data?.url) {
    return NextResponse.redirect('https://www.rent-cars.me', { status: 302 })
  }

  return NextResponse.redirect(data.url, { status: 302 })
}
