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
      vehicleId, vehicleName, partnerQrCode, guestName, guestEmail: gEmail, guestPhone,
      guestNationality, guestDob, guestLicense,
      hasSecondDriver, driver2Name, driver2License, driver2Nationality,
      insurance, insuranceTotal,
      borderCrossing, flightNumber,
      pickupDate, returnDate, pickupTime, returnTime,
      pickupLocation, dropoffLocation, transferFee, siteDomain, notes, lang = 'sr',
      extras = [], couponCode, couponDiscountPercent, couponDiscountAmount,
      partnerDiscountPercent, partnerDiscountAmount,
      extrasTotal = 0, basePrice, totalPrice,
      agentId, agentName,
    } = body

    if (!guestName || !gEmail || !guestPhone || !pickupDate || !returnDate || !pickupLocation) {
      return NextResponse.json({ error: 'Nedostaju polja' }, { status: 400 })
    }

    // Pronađi vozilo — vehicleId može biti marka__model__year key ili UUID
    // Pokušaj u vozila_fleet prvo (rent-cars koristi grupiranje)
    let resolvedVehicleName = vehicleName || vehicleId || 'Nepoznato vozilo'
    
    if (vehicleId && !vehicleId.includes('__')) {
      // Možda je numerički ID iz vozila_fleet
      const { data: fleetV } = await supabase
        .from('vozila_fleet')
        .select('agregirani_2, marka, model, year')
        .eq('id', vehicleId)
        .single()
      if (fleetV) resolvedVehicleName = fleetV.agregirani_2 || `${fleetV.marka} ${fleetV.model} ${fleetV.year}`
    } else if (vehicleId && vehicleId.includes('__')) {
      // Format: marka__model__year — ime vozila već imamo iz vehicleName
      resolvedVehicleName = vehicleName || vehicleId.split('__').join(' ')
    }

    // Pronađi partnera
    let partner = null
    if (partnerQrCode) {
      const { data: directPartner } = await supabase
        .from('partners').select('*').eq('qr_code', partnerQrCode).eq('is_active', true).single()
      if (directPartner) {
        partner = directPartner
      } else {
        const { data: qrRow } = await supabase
          .from('partner_qr_codes').select('partner_id').eq('qr_code', partnerQrCode).single()
        if (qrRow) {
          const { data: partnerData } = await supabase
            .from('partners').select('*').eq('id', qrRow.partner_id).eq('is_active', true).single()
          partner = partnerData
        }
      }
    }

    let qrLabel: string | null = null
    if (partnerQrCode) {
      const { data: qrRow } = await supabase
        .from('partner_qr_codes').select('label').eq('qr_code', partnerQrCode).single()
      qrLabel = qrRow?.label || null
    }

    const days = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86400000))
    const finalBasePrice = basePrice ?? days * 0
    const finalTotal = totalPrice ?? finalBasePrice
    const commissionPercent = partner?.commission_percent ?? 0
    const commissionAmount = finalTotal * (commissionPercent / 100)

    // Kreiraj ili pronađi klijenta
    let clientId: string | null = null
    let tempPassword: string | null = null
    let isNewClient = false

    const { data: existingClient } = await supabase
      .from('clients').select('id, user_id').eq('email', gEmail).single()

    if (existingClient) {
      clientId = existingClient.id
    } else {
      tempPassword = generateTempPassword()
      isNewClient = true
      const { data: authData } = await supabase.auth.admin.createUser({
        email: gEmail, password: tempPassword, email_confirm: true,
        user_metadata: { full_name: guestName },
      })
      const { data: newClient } = await supabase.from('clients').insert({
        email: gEmail, full_name: guestName, phone: guestPhone,
        nationality: guestNationality, user_id: authData?.user?.id || null,
      }).select().single()
      clientId = newClient?.id || null
    }

    // Kreiraj rezervaciju u reservations tabeli
    const { data: reservation, error: resErr } = await supabase.from('reservations').insert({
      vehicle_id: vehicleId || null,
      partner_id: partner?.id ?? null,
      client_id: clientId,
      guest_name: guestName,
      guest_email: gEmail,
      guest_phone: guestPhone,
      guest_nationality: guestNationality,
      guest_dob: guestDob || null,
      guest_license: guestLicense || null,
      has_second_driver: hasSecondDriver || false,
      driver2_name: driver2Name || null,
      driver2_license: driver2License || null,
      driver2_nationality: driver2Nationality || null,
      insurance: insurance || 'basic',
      insurance_total: insuranceTotal || 0,
      border_crossing: borderCrossing || null,
      flight_number: flightNumber || null,
      pickup_date: pickupDate,
      return_date: returnDate,
      pickup_time: pickupTime || '10:00',
      return_time: returnTime || '10:00',
      pickup_location: pickupLocation,
      dropoff_location: dropoffLocation || null,
      transfer_fee: transferFee || 0,
      site_domain: siteDomain || 'rent-cars.me',
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
      ref_qr_code: partnerQrCode ?? null,
      ref_qr_label: qrLabel ?? null,
      language: lang,
      status: 'pending',
      inquiry_status: 'new',
      agent_id: agentId || null,
      agent_name: agentName || null,
    }).select().single()

    if (resErr || !reservation) {
      console.error('Reservation error:', resErr)
      return NextResponse.json({ error: 'Greška pri kreiranju' }, { status: 500 })
    }

    if (extras.length > 0) {
      await supabase.from('reservation_extras').insert(
        extras.map((e: any) => ({
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
      await supabase.from('qr_scans').insert({
        partner_id: partner.id, qr_code: partnerQrCode,
        converted: true, reservation_id: reservation.id,
      })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rent-cars.me'

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const ge = guestEmail({
        guestName, vehicleName: resolvedVehicleName,
        pickupDate, returnDate, pickupLocation,
        totalPrice: finalTotal, refCode: reservation.ref_code, lang,
        isNewClient, tempPassword, siteUrl,
        pickupTime: pickupTime || '10:00', returnTime: returnTime || '10:00',
      })
      const ae = adminEmail({
        refCode: reservation.ref_code, guestName, guestEmail: gEmail, guestPhone,
        vehicleName: resolvedVehicleName, pickupDate, returnDate, pickupLocation,
        totalPrice: finalTotal, partnerName: partner?.name, commissionAmount,
        qrSource: partnerQrCode, notes,
      })
      await Promise.all([
        resend.emails.send({ from: process.env.FROM_EMAIL!, to: gEmail, subject: ge.subject, html: ge.html }),
        resend.emails.send({ from: process.env.FROM_EMAIL!, to: process.env.ADMIN_EMAIL!, subject: ae.subject, html: ae.html }),
        ...(partner?.email ? [resend.emails.send({ from: process.env.FROM_EMAIL!, to: partner.email, subject: ae.subject, html: ae.html })] : []),
      ])
    } catch (e) { console.error('Email error:', e) }

    return NextResponse.json({ success: true, refCode: reservation.ref_code, isNewClient })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Greška servera' }, { status: 500 })
  }
}
