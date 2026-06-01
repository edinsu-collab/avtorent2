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
      pickupLocation, dropoffLocation, transferFee, siteDomain, notes, lang = 'en',
      extras = [], couponCode, couponDiscountPercent, couponDiscountAmount,
      partnerDiscountPercent, partnerDiscountAmount,
      extrasTotal = 0, basePrice, totalPrice,
      agentId, agentName,
    } = body

    if (!guestName || !gEmail || !guestPhone || !pickupDate || !returnDate || !pickupLocation) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Pronađi ime vozila i license_plate
    let resolvedVehicleName = vehicleName || vehicleId || 'Unknown vehicle'
    let resolvedVehiclePlate: string | null = null

    if (vehicleId && vehicleId.includes('__')) {
      const parts = vehicleId.split('__')
      const [marka, model, year] = parts
      if (marka && model) {
        // 1. Nađi sve vozila iste grupe u odgovarajućoj regiji
        const region = (() => {
          const loc = (pickupLocation || '').toLowerCase()
          const MAP: Record<string, string> = {
            'podgorica': 'CRNA GORA', 'tivat': 'CRNA GORA', 'bar': 'CRNA GORA',
            'budva': 'CRNA GORA', 'kotor': 'CRNA GORA', 'herceg': 'CRNA GORA',
            'ulcinj': 'CRNA GORA', 'cetinje': 'CRNA GORA', 'apartment': 'CRNA GORA',
            'sarajevo': 'BiH', 'mostar': 'BiH', 'banja luka': 'BiH',
            'beograd': 'SRBIJA', 'novi sad': 'SRBIJA',
            'tirana': 'ALBANIJA', 'durres': 'ALBANIJA',
          }
          for (const [key, r] of Object.entries(MAP)) {
            if (loc.includes(key)) return r
          }
          return 'CRNA GORA'
        })()

        let q = supabase.from('vozila_fleet')
          .select('id, agregirani_2, marka, model, year, license_plate, lokacija')
          .ilike('marka', marka)
          .ilike('model', model)
          .eq('fleet_status', 'available')
          .eq('lokacija', region)
        if (year && !isNaN(parseInt(year))) q = q.eq('year', parseInt(year))
        const { data: candidates } = await q

        if (candidates && candidates.length > 0) {
          // 2. Nađi zauzeta vozila iz kalendara za taj period
          const plates = candidates.map((v: any) => v.license_plate).filter(Boolean)
          const { data: zauzeta } = plates.length > 0
            ? await supabase.from('rezervacije')
                .select('br_tablica, od_datuma, do_datuma, vreme_izdavanja, vreme_povratka')
                .in('br_tablica', plates)
            : { data: [] }

          const pickupDT = new Date(`${pickupDate}T${pickupTime || '10:00'}`)
          const returnDT = new Date(`${returnDate}T${returnTime || '10:00'}`)

          // 3. Filtriraj slobodna vozila (s 1h lufta)
          const free = candidates.filter((v: any) => {
            return !(zauzeta || []).some((z: any) => {
              const zFrom = new Date(`${z.od_datuma}T${z.vreme_izdavanja || '10:00'}`)
              const zTo = new Date(`${z.do_datuma}T${z.vreme_povratka || '10:00'}`)
              // Konflikt ako se periodi preklapaju (sa 1h lufta)
              return z.br_tablica === v.license_plate &&
                zFrom < new Date(returnDT.getTime() + 3600000) &&
                zTo > new Date(pickupDT.getTime() - 3600000)
            })
          })

          if (free.length > 0) {
            // 4. Odaberi vozilo koje se najtočnije uklapa u rupu (gap scoring)
            const reqMs = returnDT.getTime() - pickupDT.getTime()

            const scored = free.map((v: any) => {
              const vZauzeta = (zauzeta || [])
                .filter((z: any) => z.br_tablica === v.license_plate)
                .sort((a: any, b: any) => a.od_datuma.localeCompare(b.od_datuma))

              // Prethodna rezervacija koja završava prije preuzimanja
              const prev = vZauzeta.filter((z: any) =>
                new Date(`${z.do_datuma}T${z.vreme_povratka || '10:00'}`) <= pickupDT
              )
              // Sljedeća rezervacija koja počinje nakon vraćanja
              const next = vZauzeta.filter((z: any) =>
                new Date(`${z.od_datuma}T${z.vreme_izdavanja || '10:00'}`) >= returnDT
              )

              let gapMs = Infinity // potpuno slobodno
              if (prev.length > 0 && next.length > 0) {
                const gapStart = new Date(`${prev[prev.length-1].do_datuma}T${prev[prev.length-1].vreme_povratka || '10:00'}`)
                const gapEnd = new Date(`${next[0].od_datuma}T${next[0].vreme_izdavanja || '10:00'}`)
                gapMs = gapEnd.getTime() - gapStart.getTime()
              }

              // Manji višak = bolji score; potpuno slobodna vozila penalizovana
              const surplus = gapMs === Infinity ? 30 * 86400000 : gapMs - reqMs
              const score = gapMs === Infinity ? 50 : Math.max(0, 100 - (surplus / 3600000) * 2)
              return { v, score, gapMs }
            })

            scored.sort((a: any, b: any) => b.score - a.score)
            const chosen = scored[0].v
            resolvedVehicleName = chosen.agregirani_2 || vehicleName || `${chosen.marka} ${chosen.model} ${chosen.year}`
            resolvedVehiclePlate = chosen.license_plate

            // 5. Odmah upiši u kalendar da blokiramo vozilo
            const days = Math.max(1, Math.ceil((returnDT.getTime() - pickupDT.getTime()) / 86400000))
            await supabase.from('rezervacije').insert([{
              br_tablica: resolvedVehiclePlate,
              ime_prezime: guestName,
              od_datuma: pickupDate,
              do_datuma: returnDate,
              vreme_izdavanja: pickupTime || '10:00',
              vreme_povratka: returnTime || '10:00',
              mjesto_preuzimanja: pickupLocation || '',
              mjesto_povratka: body.dropoffLocation || pickupLocation || '',
              cijena_dan: Math.round((body.totalPrice || 0) / days),
              ukupno_naplata: body.totalPrice || 0,
              broj_dana: days,
              nacin_placanja: 'Keš',
              izvor_rezervacije: 'Sajt',
              daily_status: 'Na čekanju',
              napomena: 'Sajt rezervacija — čeka dodjelu',
              tip_osiguranja: body.insurance === 'kasko_full' ? 'Full Kasko' : body.insurance === 'kasko_ucesce' ? 'Kasko sa učešćem' : 'Osnovno (AO)',
            }])
          } else {
            // Sva vozila zauzeta — samo ime bez plate
            resolvedVehicleName = vehicleName || `${marka} ${model} ${year || ''}`.trim()
            resolvedVehiclePlate = null
          }
        } else {
          resolvedVehicleName = vehicleName || vehicleId.split('__').join(' ')
          resolvedVehiclePlate = null
        }
      }
    } else if (vehicleId) {
      const { data: fleetV } = await supabase
        .from('vozila_fleet').select('agregirani_2, marka, model, year, license_plate').eq('id', vehicleId).single()
      if (fleetV) {
        resolvedVehicleName = fleetV.agregirani_2 || `${fleetV.marka} ${fleetV.model} ${fleetV.year}`
        resolvedVehiclePlate = fleetV.license_plate
      }
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

    // ═══ Klijent — provjeri postoji li i ima li vozačku ═══
    let clientId: string | null = null
    let tempPassword: string | null = null
    let isNewClient = false
    let clientHasLicense = false

    const { data: existingClient } = await supabase
      .from('clients').select('id, user_id, licence_image_url, licence_number').eq('email', gEmail).single()

    if (existingClient) {
      clientId = existingClient.id
      // Klijent postoji — provjeri ima li vozačku (ili u licence_image_url ili u licence_number)
      clientHasLicense = !!(existingClient.licence_image_url || existingClient.licence_number)
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
      clientHasLicense = false
    }

    // ═══ Kreiraj rezervaciju ═══
    const { data: reservation, error: resErr } = await supabase.from('reservations').insert({
      vehicle_id: vehicleId || null,
      assigned_vehicle_name: resolvedVehicleName || null,
      assigned_vehicle_plate: resolvedVehiclePlate || null,
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
      return NextResponse.json({ error: 'Error creating reservation' }, { status: 500 })
    }

    // Extras


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
      const ADMIN_EMAILS = [
        'Edinsu@gmail.com',
        'dino.mekic@gmail.com',
        'info@planetrentacar.me',
        'besim.adzovic1@gmail.com',
      ]
      await Promise.all([
        resend.emails.send({ from: process.env.FROM_EMAIL!, to: gEmail, subject: ge.subject, html: ge.html }),
        ...ADMIN_EMAILS.map(email => resend.emails.send({ from: process.env.FROM_EMAIL!, to: email, subject: ae.subject, html: ae.html })),
        ...(partner?.email ? [resend.emails.send({ from: process.env.FROM_EMAIL!, to: partner.email, subject: ae.subject, html: ae.html })] : []),
      ])
    } catch (e) { console.error('Email error:', e) }

    return NextResponse.json({
      success: true,
      refCode: reservation.ref_code,
      isNewClient,
      hasLicense: clientHasLicense,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
