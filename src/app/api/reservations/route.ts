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
      // Format: MARKA__MODEL__YEAR — traži SVE iste modele pa biraj SLOBODAN
      const parts = vehicleId.split('__')
      const [marka, model, year] = parts
      if (marka && model) {
        let q = supabase.from('vozila_fleet')
          .select('id, agregirani_2, marka, model, year, license_plate, fleet_status, lokacija')
          .ilike('marka', marka)
          .ilike('model', model)
          .eq('fleet_status', 'available')
        if (year && !isNaN(parseInt(year))) q = q.eq('year', parseInt(year))
        const { data: fleetVehicles } = await q

        if (fleetVehicles && fleetVehicles.length > 0) {
          // Učitaj kalendar (zauzeća) za sve tablice ovih vozila
          const plates = fleetVehicles.map((v: any) => v.license_plate).filter(Boolean)
          let occupied: any[] = []
          if (plates.length > 0) {
            const { data: occ } = await supabase
              .from('rezervacije')
              .select('br_tablica, od_datuma, do_datuma')
              .in('br_tablica', plates)
            occupied = occ || []
          }

          // ═══ PAMETNI ODABIR VOZILA: traži rupu koja se najtočnije uklapa ═══
          const reqDays = Math.max(1, Math.ceil(
            (new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86400000
          ))

          type VehicleScore = { vehicle: any; score: number; gapDays: number }
          const scores: VehicleScore[] = []

          for (const v of fleetVehicles) {
            // Provjeri da li ima konflikt (vozilo zauzeto u traženom periodu)
            const hasConflict = (occupied || []).some(o =>
              o.br_tablica === v.license_plate &&
              o.od_datuma < returnDate && o.do_datuma > pickupDate
            )
            if (hasConflict) continue

            // Nađi rupu: prethodna rezervacija koja završava PRIJE pickup i sljedeća koja počinje NAKON return
            const vehicleOccupied = (occupied || [])
              .filter(o => o.br_tablica === v.license_plate)
              .sort((a: any, b: any) => a.od_datuma.localeCompare(b.od_datuma))

            // Rupa od: kraj prethodne rezervacije (ili -∞)
            const prevRez = vehicleOccupied.filter((o: any) => o.do_datuma <= pickupDate)
            const nextRez = vehicleOccupied.filter((o: any) => o.od_datuma >= returnDate)

            const gapStart = prevRez.length > 0 ? prevRez[prevRez.length - 1].do_datuma : null
            const gapEnd = nextRez.length > 0 ? nextRez[0].od_datuma : null

            let gapDays = 999 // potpuno slobodno
            if (gapStart && gapEnd) {
              gapDays = Math.ceil(
                (new Date(gapEnd).getTime() - new Date(gapStart).getTime()) / 86400000
              )
            } else if (gapStart && !gapEnd) {
              gapDays = 999 // slobodno do kraja
            } else if (!gapStart && gapEnd) {
              gapDays = Math.ceil(
                (new Date(gapEnd).getTime() - new Date(pickupDate).getTime()) / 86400000
              )
            }

            // Score: manja rupa = bolji fit (penalizuj previše veliku rupu)
            // Idealno: gapDays == reqDays (score = 100)
            // Prihvatljivo: gapDays > reqDays (manji višak = bolji score)
            // Odbaci: gapDays < reqDays (ne može stati)
            if (gapDays < reqDays) continue

            const viska = gapDays === 999 ? 30 : gapDays - reqDays
            // Penalizuj potpuno slobodna vozila (999) — preferuj ona sa rupom
            // Bonus ako je vozilo u istoj regiji kao lokacija preuzimanja
            const regionBonus = (() => {
              if (!pickupLocation || !v.lokacija) return 0
              const loc = pickupLocation.toLowerCase()
              const vLok = v.lokacija
              if (vLok === 'CRNA GORA' && (loc.includes('podgorica') || loc.includes('tivat') || loc.includes('bar') || loc.includes('budva') || loc.includes('kotor') || loc.includes('crna gora') || loc.includes('montenegro'))) return 15
              if (vLok === 'BiH' && (loc.includes('sarajevo') || loc.includes('mostar') || loc.includes('bih') || loc.includes('bosna'))) return 15
              if (vLok === 'SRBIJA' && (loc.includes('beograd') || loc.includes('srbija') || loc.includes('novi sad'))) return 15
              if (vLok === 'ALBANIJA' && (loc.includes('tirana') || loc.includes('albanija') || loc.includes('albania'))) return 15
              return 0
            })()

            const score = (gapDays === 999 ? 50 : Math.max(0, 100 - viska * 3)) + regionBonus

            scores.push({ vehicle: v, score, gapDays })
          }

          // Sortiraj po score (veći = bolji fit u rupu)
          scores.sort((a, b) => b.score - a.score)

          const chosen = scores.length > 0 ? scores[0].vehicle : fleetVehicles[0]

          resolvedVehicleName = chosen.agregirani_2 || vehicleName || `${chosen.marka} ${chosen.model} ${chosen.year}`
          resolvedVehiclePlate = chosen.license_plate

          // ═══ ODMAH rezerviši u kalendar da blokiramo vozilo ═══
          const reqDaysCalendar = Math.max(1, Math.ceil(
            (new Date(returnDate).getTime() - new Date(pickupDate).getTime()) / 86400000
          ))
          const calPayload = {
            br_tablica: resolvedVehiclePlate,
            ime_prezime: guestName,
            telefon: body.guestPhone || '',
            email: gEmail,
            od_datuma: pickupDate,
            do_datuma: returnDate,
            vreme_izdavanja: body.pickupTime || '10:00',
            vreme_povratka: body.returnTime || '10:00',
            mjesto_preuzimanja: body.pickupLocation || '',
            mjesto_povratka: body.dropoffLocation || body.pickupLocation || '',
            cijena_dan: Math.round((body.totalPrice || 0) / reqDaysCalendar),
            ukupno_naplata: body.totalPrice || 0,
            broj_dana: reqDaysCalendar,
            nacin_placanja: 'Keš',
            izvor_rezervacije: 'Sajt',
            daily_status: 'Na čekanju',
            napomena: `Sajt ref: PENDING`,
            tip_osiguranja: body.insurance === 'kasko_full' ? 'Full Kasko' : body.insurance === 'kasko_ucesce' ? 'Kasko sa učešćem' : 'Osnovno (AO)',
          }
          const { error: calErr } = await supabase.from('rezervacije').insert([calPayload])
          if (calErr) console.error('Kalendar insert greška:', JSON.stringify(calErr))

          // ═══ PROVJERI DUPLIKAT: koliko puta je ovo vozilo sad u kalendaru za ovaj period? ═══
          const { data: dupCheck } = await supabase
            .from('rezervacije')
            .select('id')
            .eq('br_tablica', resolvedVehiclePlate)
            .lte('od_datuma', returnDate)
            .gt('do_datuma', pickupDate)
            .eq('izvor_rezervacije', 'Sajt')

          if (dupCheck && dupCheck.length > 1) {
            // Vozilo već zauzeto — nađi sljedeće slobodno iz scores liste
            const alreadyUsed = new Set([resolvedVehiclePlate])
            
            // Učitaj sve zauzete ponovo
            const { data: occNow } = await supabase
              .from('rezervacije')
              .select('br_tablica, od_datuma, do_datuma')
              .in('br_tablica', plates)
            
            const nextFree = scores.find(s => {
              if (alreadyUsed.has(s.vehicle.license_plate)) return false
              const conflict = (occNow || []).some((o: any) =>
                o.br_tablica === s.vehicle.license_plate &&
                o.od_datuma < returnDate && o.do_datuma > pickupDate
              )
              return !conflict
            })

            if (nextFree) {
              // Obrisi pogrešan insert i stavi na pravo vozilo
              await supabase.from('rezervacije').delete()
                .eq('br_tablica', resolvedVehiclePlate)
                .eq('od_datuma', pickupDate)
                .eq('napomena', 'Sajt ref: PENDING')
                .eq('izvor_rezervacije', 'Sajt')
                .limit(1)

              resolvedVehiclePlate = nextFree.vehicle.license_plate
              resolvedVehicleName = nextFree.vehicle.agregirani_2 || `${nextFree.vehicle.marka} ${nextFree.vehicle.model}`
              
              await supabase.from('rezervacije').insert([{
                ...calPayload,
                br_tablica: resolvedVehiclePlate,
              }])
            }
          }
        } else {
          resolvedVehicleName = vehicleName || vehicleId.split('__').join(' ')
        }
      }
    } else if (vehicleId) {
      // Numerički ID
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
    // Ažuriraj napomenu u kalendaru sa pravim ref_code
    if (resolvedVehiclePlate && reservation) {
      await supabase.from('rezervacije')
        .update({ napomena: `Sajt ref: ${reservation.ref_code}` })
        .eq('br_tablica', resolvedVehiclePlate)
        .eq('od_datuma', pickupDate)
        .eq('napomena', 'Sajt ref: PENDING')
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
