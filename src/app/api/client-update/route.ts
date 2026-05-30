import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Service role key — samo na serveru, nikad na frontendu
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientId, ...updateData } = body

    if (!clientId) {
      return Response.json({ error: 'clientId required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('clients')
      .update(updateData)
      .eq('id', clientId)

    if (error) {
      console.error('Client update error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
