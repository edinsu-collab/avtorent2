// ─────────────────────────────────────────────────────────────
//  AdriaDrive – email templates (guest + admin)
//  - Obračun se računa iz totalPrice (uvijek se slaže s UKUPNO)
//  - i18n: sr / en / de za cijelo tijelo guest maila
//  - Osiguranje mapirano po jeziku
// ─────────────────────────────────────────────────────────────

type Lang = 'sr' | 'en' | 'de'

function normLang(l?: string): Lang {
  return l === 'en' ? 'en' : l === 'de' ? 'de' : 'sr'
}

function dayWord(n: number, lang: Lang): string {
  if (lang === 'en') return n === 1 ? 'day' : 'days'
  if (lang === 'de') return n === 1 ? 'Tag' : 'Tage'
  return n === 1 ? 'dan' : 'dana' // sr
}

function insuranceLabel(code: string | undefined, lang: Lang): string {
  const map: Record<string, Record<Lang, string>> = {
    basic:   { sr: 'Osnovno (AO)',      en: 'Basic (TPL)',        de: 'Basis (Haftpflicht)' },
    full:    { sr: 'Puno kasko (CDW)',  en: 'Full (CDW)',         de: 'Vollkasko (CDW)' },
    kasko:   { sr: 'Kasko',             en: 'Comprehensive',      de: 'Kasko' },
    premium: { sr: 'Premium kasko',     en: 'Premium',            de: 'Premium' },
  }
  if (!code) return map.basic[lang]
  const key = code.toLowerCase().trim()
  if (map[key]) return map[key][lang]
  // fallback: kapitalizuj sirovu vrijednost
  return code.charAt(0).toUpperCase() + code.slice(1)
}

// Centralni izračun obračuna — Najam = total − osiguranje − extras.
// Time se obračun UVIJEK slaže s UKUPNO, bez obzira što je proslijeđeno kao pricePerDay.
function calcBilling(d: {
  totalPrice: number; days?: number
  insuranceTotal?: number
  extras?: { name: string; price: number }[]
}) {
  const extrasTotal = (d.extras || []).reduce((s, e) => s + (e.price || 0), 0)
  const insCost = d.insuranceTotal || 0
  const rentalSubtotal = Math.max(0, (d.totalPrice || 0) - insCost - extrasTotal)
  // prikaži "× X€" samo ako se dijeli ravno (inače bi 7 × 41 ≠ stvarni iznos)
  const perDayExact =
    d.days && d.days > 0 && rentalSubtotal % d.days === 0
      ? rentalSubtotal / d.days
      : null
  return { rentalSubtotal, perDayExact, extrasTotal, insCost }
}

const T: Record<Lang, Record<string, string>> = {
  sr: {
    confirmed: '✅ Rezervacija potvrđena',
    dear: 'Poštovani/a',
    intro: 'Vaša rezervacija je uspješno primljena. Posjetite naš portal kako biste unijeli podatke za ugovor.',
    refLabel: 'Referentni broj rezervacije',
    vehicle: '🚗 Vozilo',
    model: 'Model',
    plates: 'Tablice',
    insurance: 'Osiguranje',
    secondDriver: 'Drugi vozač',
    period: '📅 Period najma',
    pickup: 'Preuzimanje',
    dropoff: 'Vraćanje',
    pickupLoc: 'Lokacija preuzimanja',
    dropoffLoc: 'Lokacija vraćanja',
    flight: 'Broj leta',
    border: 'Izlaz iz CG',
    duration: 'Trajanje',
    billing: '💰 Obračun',
    rental: 'Najam',
    total: 'UKUPNO',
    payNote: 'Plaćanje gotovinom ili karticom pri preuzimanju vozila. Za karticu +3% bankarske usluge.',
    myRes: 'Moje rezervacije →',
    accCreated: '🎉 Vaš nalog je kreiran!',
    accDesc: 'Pratite rezervacije i unesite podatke za ugovor.',
    tempPass: 'Privremena lozinka',
    login: 'Prijavite se →',
    passHint: 'Preporučujemo promjenu lozinke pri prvoj prijavi.',
    at: 'u',
  },
  en: {
    confirmed: '✅ Reservation confirmed',
    dear: 'Dear',
    intro: 'Your reservation has been received successfully. Please visit our portal to enter your contract details.',
    refLabel: 'Reservation reference number',
    vehicle: '🚗 Vehicle',
    model: 'Model',
    plates: 'Plates',
    insurance: 'Insurance',
    secondDriver: 'Second driver',
    period: '📅 Rental period',
    pickup: 'Pick-up',
    dropoff: 'Return',
    pickupLoc: 'Pick-up location',
    dropoffLoc: 'Return location',
    flight: 'Flight number',
    border: 'Leaving Montenegro',
    duration: 'Duration',
    billing: '💰 Summary',
    rental: 'Rental',
    total: 'TOTAL',
    payNote: 'Payment in cash or by card upon vehicle pick-up. +3% bank fee for card payments.',
    myRes: 'My reservations →',
    accCreated: '🎉 Your account has been created!',
    accDesc: 'Track your reservations and enter your contract details.',
    tempPass: 'Temporary password',
    login: 'Sign in →',
    passHint: 'We recommend changing your password on first login.',
    at: 'at',
  },
  de: {
    confirmed: '✅ Buchung bestätigt',
    dear: 'Sehr geehrte/r',
    intro: 'Ihre Buchung wurde erfolgreich erhalten. Bitte besuchen Sie unser Portal, um Ihre Vertragsdaten einzugeben.',
    refLabel: 'Buchungsreferenznummer',
    vehicle: '🚗 Fahrzeug',
    model: 'Modell',
    plates: 'Kennzeichen',
    insurance: 'Versicherung',
    secondDriver: 'Zweiter Fahrer',
    period: '📅 Mietzeitraum',
    pickup: 'Abholung',
    dropoff: 'Rückgabe',
    pickupLoc: 'Abholort',
    dropoffLoc: 'Rückgabeort',
    flight: 'Flugnummer',
    border: 'Ausreise aus Montenegro',
    duration: 'Dauer',
    billing: '💰 Abrechnung',
    rental: 'Miete',
    total: 'GESAMT',
    payNote: 'Zahlung in bar oder mit Karte bei Fahrzeugübernahme. +3% Bankgebühr bei Kartenzahlung.',
    myRes: 'Meine Buchungen →',
    accCreated: '🎉 Ihr Konto wurde erstellt!',
    accDesc: 'Verfolgen Sie Ihre Buchungen und geben Sie Ihre Vertragsdaten ein.',
    tempPass: 'Temporäres Passwort',
    login: 'Anmelden →',
    passHint: 'Wir empfehlen, das Passwort bei der ersten Anmeldung zu ändern.',
    at: 'um',
  },
}

export function guestEmail(d: {
  guestName: string; vehicleName: string; pickupDate: string; returnDate: string
  pickupLocation: string; dropoffLocation?: string; pickupTime?: string; returnTime?: string
  totalPrice: number; refCode: string; lang: string
  insurance?: string; insuranceTotal?: number
  borderCrossing?: string; flightNumber?: string
  extras?: { name: string; price: number }[]
  hasSecondDriver?: boolean; driver2Name?: string
  guestPhone?: string; guestNationality?: string
  days?: number; pricePerDay?: number
  isNewClient?: boolean; tempPassword?: string | null; siteUrl?: string
  assignedVehicle?: string | null
}) {
  const lang = normLang(d.lang)
  const t = T[lang]
  const subject = lang === 'en'
    ? `Reservation Confirmed – ${d.refCode}`
    : lang === 'de'
    ? `Buchungsbestätigung – ${d.refCode}`
    : `Potvrda rezervacije – ${d.refCode}`

  const { rentalSubtotal, perDayExact } = calcBilling(d)
  const insLabel = insuranceLabel(d.insurance, lang)
  const durationText = d.days
    ? `${d.days} ${dayWord(d.days, lang)}${perDayExact ? ` × ${perDayExact}€` : ''}`
    : ''
  const rentalText = d.days
    ? `${t.rental} (${d.days} ${dayWord(d.days, lang)}${perDayExact ? ` × ${perDayExact}€` : ''})`
    : t.rental

  const accountSection = d.isNewClient && d.tempPassword ? `
    <div style="background:#e8f0fb;border:1px solid #4a90d9;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
      <div style="font-size:15px;font-weight:bold;color:#0e2d5e;margin-bottom:8px">${t.accCreated}</div>
      <div style="font-size:13px;color:#0e2d5e;margin-bottom:14px">${t.accDesc}</div>
      <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:14px;display:inline-block">
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px">${t.tempPass}</div>
        <div style="font-size:20px;font-weight:bold;font-family:monospace;color:#1a56a0;letter-spacing:2px">${d.tempPassword}</div>
      </div>
      <a href="${d.siteUrl}/moje/login" style="display:inline-block;padding:10px 22px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px">${t.login}</a>
      <div style="font-size:11px;color:#9ca3af;margin-top:10px">${t.passHint}</div>
    </div>
  ` : ''

  const extrasRows = d.extras && d.extras.length > 0
    ? d.extras.map(e => `<tr><td style="color:#666;padding:4px 0;border-bottom:1px solid #eee;font-size:13px">+ ${e.name}</td><td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee;font-size:13px">${e.price}€</td></tr>`).join('')
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;color:#333;background:#f9fafb">

  <div style="background:#0e2d5e;padding:24px;text-align:center">
    <div style="font-weight:800;font-size:22px;color:#fff;letter-spacing:1px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
    <div style="font-size:10px;color:#4a90d9;letter-spacing:3px;margin-top:4px">BALKAN · RENT A CAR</div>
  </div>

  <div style="background:#1D9E75;padding:14px 24px;text-align:center">
    <div style="font-size:13px;font-weight:700;color:#fff">${t.confirmed}</div>
  </div>

  <div style="background:#fff;padding:28px 24px">
    <p style="margin:0 0 16px">${t.dear} <strong>${d.guestName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">${t.intro}</p>

    <div style="background:#f0fdf8;border:2px solid #1D9E75;border-radius:10px;padding:16px;text-align:center;margin:0 0 24px">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">${t.refLabel}</div>
      <div style="font-size:24px;font-weight:bold;font-family:monospace;color:#0e2d5e">${d.refCode}</div>
    </div>

    <!-- VOZILO -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${t.vehicle}</div>
      <table style="width:100%;font-size:14px">
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.model}</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.vehicleName}</td></tr>
        ${d.assignedVehicle ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.plates}</td><td style="text-align:right;font-family:monospace;font-weight:700;color:#1D9E75;padding:5px 0;border-bottom:1px solid #eee">${d.assignedVehicle}</td></tr>` : ''}
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.insurance}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${insLabel}</td></tr>
        ${d.hasSecondDriver && d.driver2Name ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.secondDriver}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.driver2Name}</td></tr>` : ''}
      </table>
    </div>

    <!-- PERIOD -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${t.period}</div>
      <table style="width:100%;font-size:14px">
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.pickup}</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.pickupDate} ${t.at} ${(d.pickupTime || '10:00').slice(0,5)}h</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.dropoff}</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.returnDate} ${t.at} ${(d.returnTime || '10:00').slice(0,5)}h</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.pickupLoc}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.pickupLocation}</td></tr>
        ${d.dropoffLocation && d.dropoffLocation !== d.pickupLocation ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.dropoffLoc}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.dropoffLocation}</td></tr>` : ''}
        ${d.flightNumber ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.flight}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">✈️ ${d.flightNumber}</td></tr>` : ''}
        ${d.borderCrossing && d.borderCrossing !== 'Ne' && d.borderCrossing !== 'No' ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${t.border}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.borderCrossing}</td></tr>` : ''}
        ${d.days ? `<tr><td style="color:#666;padding:5px 0">${t.duration}</td><td style="text-align:right;padding:5px 0">${durationText}</td></tr>` : ''}
      </table>
    </div>

    <!-- OBRAČUN -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">${t.billing}</div>
      <table style="width:100%;font-size:14px">
        ${d.days ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${rentalText}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${rentalSubtotal}€</td></tr>` : ''}
        ${d.insurance && d.insuranceTotal ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${insLabel}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.insuranceTotal}€</td></tr>` : ''}
        ${extrasRows}
        <tr><td style="font-weight:700;font-size:16px;padding:12px 0 4px;color:#0e2d5e">${t.total}</td><td style="text-align:right;font-weight:700;font-size:16px;color:#1D9E75;padding:12px 0 4px">${d.totalPrice}€</td></tr>
      </table>
      <div style="font-size:12px;color:#9ca3af;margin-top:8px">${t.payNote}</div>
    </div>

    ${accountSection}

    <div style="text-align:center;margin-top:20px">
      <a href="https://www.rent-cars.me/moje" style="display:inline-block;padding:12px 28px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px">${t.myRes}</a>
    </div>
  </div>

  <div style="background:#0e2d5e;padding:20px 24px;text-align:center">
    <div style="font-weight:800;font-size:14px;color:#fff;letter-spacing:1px;margin-bottom:6px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span></div>
    <div style="font-size:12px;color:#7ab8f5">
      <a href="mailto:info@rent-cars.me" style="color:#7ab8f5;text-decoration:none">info@rent-cars.me</a>
      &nbsp;·&nbsp;
      <a href="https://rent-cars.me" style="color:#7ab8f5;text-decoration:none">rent-cars.me</a>
    </div>
    <div style="font-size:11px;color:#4a90d9;margin-top:8px;font-style:italic;font-family:Georgia,serif">"Feel the Balkans. Own the road."</div>
  </div>

</body></html>`

  return { subject, html }
}

export function adminEmail(d: {
  refCode: string; guestName: string; guestEmail: string; guestPhone: string
  vehicleName: string; assignedVehicle?: string | null
  pickupDate: string; returnDate: string; pickupTime?: string; returnTime?: string
  pickupLocation: string; dropoffLocation?: string
  totalPrice: number; days?: number; pricePerDay?: number
  insurance?: string; insuranceTotal?: number
  borderCrossing?: string; flightNumber?: string
  extras?: { name: string; price: number }[]
  hasSecondDriver?: boolean; driver2Name?: string; driver2License?: string
  guestNationality?: string; guestDob?: string; guestLicense?: string
  partnerName?: string; commissionAmount?: number; qrSource?: string; notes?: string
}) {
  const subject = `🚗 Nova rezervacija ${d.refCode} — ${d.guestName}`

  // admin ostaje na srpskom, ali obračun se računa isto (da se ne pojavi 2009)
  const { rentalSubtotal, perDayExact } = calcBilling(d)
  const insLabel = insuranceLabel(d.insurance, 'sr')
  const rentalText = d.days
    ? `Najam (${d.days} ${dayWord(d.days, 'sr')}${perDayExact ? ` × ${perDayExact}€` : ''})`
    : 'Najam'

  const extrasRows = d.extras && d.extras.length > 0
    ? d.extras.map(e => `<tr><td style="color:#666;padding:4px 0;border-bottom:1px solid #eee;font-size:13px">+ ${e.name}</td><td style="text-align:right;padding:4px 0;border-bottom:1px solid #eee;font-size:13px">${e.price}€</td></tr>`).join('')
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;background:#f9fafb">

  <div style="background:#0e2d5e;padding:20px 24px">
    <div style="font-weight:800;font-size:16px;color:#fff;letter-spacing:1px">ADRIA<span style="font-weight:300;color:#4a90d9">DRIVE</span> <span style="font-weight:300;font-size:13px;color:#7ab8f5">— Admin obavještenje</span></div>
    <div style="font-size:18px;font-weight:700;color:#4a90d9;margin-top:6px">${d.refCode}</div>
  </div>

  <div style="background:#fff;padding:24px">

    <!-- GOST -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">👤 Gost</div>
      <table style="width:100%;font-size:14px">
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Ime</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.guestName}</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Email</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestEmail}</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Telefon</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestPhone}</td></tr>
        ${d.guestNationality ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Nacionalnost</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestNationality}</td></tr>` : ''}
        ${d.guestDob ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Datum rođenja</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestDob}</td></tr>` : ''}
        ${d.guestLicense ? `<tr><td style="color:#666;padding:5px 0">Br. vozačke</td><td style="text-align:right;padding:5px 0">${d.guestLicense}</td></tr>` : ''}
      </table>
    </div>

    <!-- VOZILO & PERIOD -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🚗 Vozilo & Period</div>
      <table style="width:100%;font-size:14px">
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Vozilo</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.vehicleName}</td></tr>
        ${d.assignedVehicle ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Tablice</td><td style="text-align:right;font-family:monospace;font-weight:700;color:#1D9E75;padding:5px 0;border-bottom:1px solid #eee">${d.assignedVehicle}</td></tr>` : '<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Tablice</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee;color:#f59e0b;font-weight:600">⏳ Čeka dodjelu</td></tr>'}
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Preuzimanje</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.pickupDate} u ${(d.pickupTime || '10:00').slice(0,5)}h</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Vraćanje</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.returnDate} u ${(d.returnTime || '10:00').slice(0,5)}h</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Lokacija preuzimanja</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.pickupLocation}</td></tr>
        ${d.dropoffLocation && d.dropoffLocation !== d.pickupLocation ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Lokacija vraćanja</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.dropoffLocation}</td></tr>` : ''}
        ${d.flightNumber ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Broj leta</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">✈️ ${d.flightNumber}</td></tr>` : ''}
        ${d.borderCrossing && d.borderCrossing !== 'Ne' && d.borderCrossing !== 'No' ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Izlaz iz CG</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.borderCrossing}</td></tr>` : ''}
        <tr><td style="color:#666;padding:5px 0">Osiguranje</td><td style="text-align:right;padding:5px 0">${insLabel}</td></tr>
      </table>
    </div>

    ${d.hasSecondDriver && d.driver2Name ? `
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">👥 Drugi vozač</div>
      <table style="width:100%;font-size:14px">
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Ime</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.driver2Name}</td></tr>
        ${d.driver2License ? `<tr><td style="color:#666;padding:5px 0">Br. vozačke</td><td style="text-align:right;padding:5px 0">${d.driver2License}</td></tr>` : ''}
      </table>
    </div>` : ''}

    <!-- OBRAČUN -->
    <div style="background:#f0fdf8;border:1px solid #1D9E75;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#085041;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💰 Obračun</div>
      <table style="width:100%;font-size:14px">
        ${d.days ? `<tr><td style="color:#555;padding:5px 0;border-bottom:1px solid #d1fae5">${rentalText}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #d1fae5">${rentalSubtotal}€</td></tr>` : ''}
        ${d.insurance && d.insuranceTotal ? `<tr><td style="color:#555;padding:5px 0;border-bottom:1px solid #d1fae5">${insLabel}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #d1fae5">${d.insuranceTotal}€</td></tr>` : ''}
        ${extrasRows}
        <tr><td style="font-weight:700;font-size:16px;padding:12px 0 0;color:#085041">UKUPNO</td><td style="text-align:right;font-weight:700;font-size:16px;color:#1D9E75;padding:12px 0 0">${d.totalPrice}€</td></tr>
      </table>
    </div>

    ${d.partnerName ? `<div style="background:#FAEEDA;border:1px solid #EF9F27;border-radius:8px;padding:14px;margin-bottom:16px"><strong>📲 Izvor (QR): ${d.partnerName}</strong><br><span style="font-size:13px">Provizija: ${d.commissionAmount?.toFixed(2)}€ · QR: ${d.qrSource}</span></div>` : ''}
    ${d.notes ? `<div style="padding:12px;background:#f5f5f5;border-radius:8px;font-size:13px"><strong>📝 Napomena:</strong> ${d.notes}</div>` : ''}
  </div>

</body></html>`
  return { subject, html }
}
