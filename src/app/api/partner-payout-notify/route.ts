import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const { partnerName, partnerEmail, amount, note } = await req.json()
    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to: partnerEmail,
      subject: `AvtoRent — Zahtjev za isplatu provizije ${amount.toFixed(2)}€`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
          <div style="background:#1D9E75;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:20px">AvtoRent Montenegro</h1>
          </div>
          <div style="padding:28px 24px">
            <p>Poštovani/a <strong>${partnerName}</strong>,</p>
            <p>Administrator je pokrenuo zahtjev za isplatu vaše provizije.</p>
            <div style="background:#E1F5EE;border:1px solid #5DCAA5;border-radius:10px;padding:20px;text-align:center;margin:20px 0">
              <div style="font-size:13px;color:#085041;margin-bottom:6px">Iznos isplate</div>
              <div style="font-size:32px;font-weight:700;color:#1D9E75">${amount.toFixed(2)}€</div>
              ${note ? `<div style="font-size:13px;color:#085041;margin-top:8px">${note}</div>` : ''}
            </div>
            <p style="font-size:14px;color:#374151">Prijavite se na vaš partner portal i potvrdite prijem sredstava:</p>
            <div style="text-align:center;margin:20px 0">
              <a href="${siteUrl}/partner" style="display:inline-block;padding:12px 28px;background:#1D9E75;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
                Potvrdi prijem na partner portalu
              </a>
            </div>
            <p style="font-size:12px;color:#9ca3af">Link na portal: ${siteUrl}/partner/login</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Greška' }, { status: 500 })
  }
}
