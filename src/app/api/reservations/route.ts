import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { guestEmail, adminEmail } from '@/lib/emails'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await req.json()
    const {
      vehicleId, partnerQrCode, guestName, guestEmail: gEmail, guestPhone,
      guestNationality, pickupDate, returnDate, pickupTime, returnTime,
      pickupLocation, notes, lang = 'sr',
      extras = [], couponCode, couponDiscountPercent, couponDiscountAmount,
      partnerDiscountPercent, partnerDiscountAmount,
      extrasTotal = 0, basePrice, totalPrice,
      agentId, agentName,
    } = body

    if (!vehicleId || !guestName || !gEmail || !guestPhone || !pickupDate || !returnDate || !pickupLocation) {
      return NextResponse.json({ error: 'Nedostaju polja' }, { status: 400 })
    }

    const { data: vehicle } = await supabase.from('vehicles').select('*').eq('id', vehicleId).single()
    if (!vehicle) return NextResponse.json({ error: 'Vozilo nije pronađeno' }, { status: 404 })

    let partner = null
    if (partnerQrCode) {
      const { data } = await supabase.from('partners').select('*').eq('qr_code', partnerQrCode).eq('is_active', true).single()
      partner = data
    }

    const days = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86400000))
    const finalBasePrice = basePrice ?? days * vehicle.price_per_day
    const finalTotal = totalPrice ?? finalBasePrice
    const commissionPercent = partner?.commission_percent ?? 0
    const commissionAmount = finalTotal * (commissionPercent / 100)

    // Kreiraj ili pronađi klijenta + Supabase nalog
    let clientId: string | null = null
    let tempPassword: string | null = null
    let isNewClient = false

    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('email', gEmail)
      .single()

    if (existingClient) {
      clientId = existingClient.id
    } else {
      // Novi klijent — kreiraj Supabase auth nalog sa privremenom lozinkom
      tempPassword = generateTempPassword()
      isNewClient = true

      const { data: authData } = await supabase.auth.admin.createUser({
        email: gEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: guestName },
      })

      const { data: newClient } = await supabase.from('clients').insert({
        email: gEmail,
        full_name: guestName,
        phone: guestPhone,
        nationality: guestNationality,
        user_id: authData?.user?.id || null,
      }).select().single()

      clientId = newClient?.id || null
    }

    // Kreiraj rezervaciju
    const { data: reservation, error: resErr } = await supabase.from('reservations').insert({
      vehicle_id: vehicleId,
      partner_id: partner?.id ?? null,
      client_id: clientId,
      guest_name: guestName,
      guest_email: gEmail,
      guest_phone: guestPhone,
      guest_nationality: guestNationality,
      pickup_date: pickupDate,
      return_date: returnDate,
      pickup_time: pickupTime || '10:00',
      return_time: returnTime || '10:00',
      pickup_location: pickupLocation,
      notes,
      base_price: finalBasePrice,
      extras_total: extrasTotal,
      total_price: finalTotal,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      coupon_code: couponCode || null,
      coupon_discount_percent: couponDiscountPercent || null,
      coupon_discount_amount: couponDiscountAmount || null,
      partner_discount_percent: partnerDiscountPercent || null,
      partner_discount_amount: partnerDiscountAmount || null,
      qr_source: partnerQrCode ?? null,
      language: lang,
      status: 'confirmed',
      agent_id: agentId || null,
      agent_name: agentName || null,
    }).select().single()

    if (resErr || !reservation) {
      console.error('Reservation error:', resErr)
      return NextResponse.json({ error: 'Greška pri kreiranju' }, { status: 500 })
    }

    if (extras.length > 0) {
      await supabase.from('reservation_extras').insert(
        extras.map((e: { extraId: string; extraName: string; pricePerUnit: number; days: number; totalPrice: number; type: string }) => ({
          reservation_id: reservation.id,
          extra_id: e.extraId,
          extra_name: e.extraName,
          price_per_unit: e.pricePerUnit,
          days: e.days,
          total_price: e.totalPrice,
          type: e.type,
        }))
      )
    }

    if (partnerQrCode && partner) {
      await supabase.from('qr_scans').insert({ partner_id: partner.id, qr_code: partnerQrCode, converted: true, reservation_id: reservation.id })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const ge = guestEmail({
        guestName, vehicleName: vehicle.name, pickupDate, returnDate,
        pickupLocation, totalPrice: finalTotal, refCode: reservation.ref_code, lang,
        isNewClient, tempPassword, siteUrl,
      })
      const ae = adminEmail({
        refCode: reservation.ref_code, guestName, guestEmail: gEmail, guestPhone,
        vehicleName: vehicle.name, pickupDate, returnDate, pickupLocation,
        totalPrice: finalTotal, partnerName: partner?.name, commissionAmount,
        qrSource: partnerQrCode, notes,
      })
      await Promise.all([
        resend.emails.send({ from: process.env.FROM_EMAIL!, to: gEmail, subject: ge.subject, html: ge.html }),
        resend.emails.send({ from: process.env.FROM_EMAIL!, to: process.env.ADMIN_EMAIL!, subject: ae.subject, html: ae.html }),
      ])
    } catch (e) { console.error('Email error:', e) }

    return NextResponse.json({ success: true, refCode: reservation.ref_code, isNewClient })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Greška servera' }, { status: 500 })
  }
}
