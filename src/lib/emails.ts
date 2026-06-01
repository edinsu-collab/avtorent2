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
  const subject = d.lang === 'en' ? `Reservation Confirmed – ${d.refCode}` : d.lang === 'de' ? `Buchungsbestätigung – ${d.refCode}` : `Potvrda rezervacije – ${d.refCode}`

  const accountSection = d.isNewClient && d.tempPassword ? `
    <div style="background:#e8f0fb;border:1px solid #4a90d9;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
      <div style="font-size:15px;font-weight:bold;color:#0e2d5e;margin-bottom:8px">🎉 Vaš nalog je kreiran!</div>
      <div style="font-size:13px;color:#0e2d5e;margin-bottom:14px">Pratite rezervacije i unesite podatke za ugovor.</div>
      <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:14px;display:inline-block">
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px">Privremena lozinka</div>
        <div style="font-size:20px;font-weight:bold;font-family:monospace;color:#1a56a0;letter-spacing:2px">${d.tempPassword}</div>
      </div>
      <a href="${d.siteUrl}/moje/login" style="display:inline-block;padding:10px 22px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px">Prijavite se →</a>
      <div style="font-size:11px;color:#9ca3af;margin-top:10px">Preporučujemo promjenu lozinke pri prvoj prijavi.</div>
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
    <div style="font-size:13px;font-weight:700;color:#fff">✅ Rezervacija potvrđena</div>
  </div>

  <div style="background:#fff;padding:28px 24px">
    <p style="margin:0 0 16px">Poštovani/a <strong>${d.guestName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555">Vaša rezervacija je uspješno primljena. Posjetite naš portal kako biste unijeli podatke za ugovor.</p>

    <div style="background:#f0fdf8;border:2px solid #1D9E75;border-radius:10px;padding:16px;text-align:center;margin:0 0 24px">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Referentni broj rezervacije</div>
      <div style="font-size:24px;font-weight:bold;font-family:monospace;color:#0e2d5e">${d.refCode}</div>
    </div>

    <!-- VOZILO -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🚗 Vozilo</div>
      <table style="width:100%;font-size:14px">
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Model</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.vehicleName}</td></tr>
        ${d.assignedVehicle ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Tablice</td><td style="text-align:right;font-family:monospace;font-weight:700;color:#1D9E75;padding:5px 0;border-bottom:1px solid #eee">${d.assignedVehicle}</td></tr>` : ''}
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Osiguranje</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.insurance || 'Osnovno (AO)'}</td></tr>
        ${d.hasSecondDriver && d.driver2Name ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Drugi vozač</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.driver2Name}</td></tr>` : ''}
      </table>
    </div>

    <!-- PERIOD -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">📅 Period najma</div>
      <table style="width:100%;font-size:14px">
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Preuzimanje</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.pickupDate} u ${(d.pickupTime || '10:00').slice(0,5)}h</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Vraćanje</td><td style="text-align:right;font-weight:600;padding:5px 0;border-bottom:1px solid #eee">${d.returnDate} u ${(d.returnTime || '10:00').slice(0,5)}h</td></tr>
        <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Lokacija preuzimanja</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.pickupLocation}</td></tr>
        ${d.dropoffLocation && d.dropoffLocation !== d.pickupLocation ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Lokacija vraćanja</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.dropoffLocation}</td></tr>` : ''}
        ${d.flightNumber ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Broj leta</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">✈️ ${d.flightNumber}</td></tr>` : ''}
        ${d.borderCrossing && d.borderCrossing !== 'Ne' && d.borderCrossing !== 'No' ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Izlaz iz CG</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.borderCrossing}</td></tr>` : ''}
        ${d.days ? `<tr><td style="color:#666;padding:5px 0">Trajanje</td><td style="text-align:right;padding:5px 0">${d.days} dana${d.pricePerDay ? ` × ${d.pricePerDay}€` : ''}</td></tr>` : ''}
      </table>
    </div>

    <!-- OBRAČUN -->
    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💰 Obračun</div>
      <table style="width:100%;font-size:14px">
        ${d.days && d.pricePerDay ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Najam (${d.days} dana × ${d.pricePerDay}€)</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.days * d.pricePerDay}€</td></tr>` : ''}
        ${d.insurance && d.insuranceTotal ? `<tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">${d.insurance}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.insuranceTotal}€</td></tr>` : ''}
        ${extrasRows}
        <tr><td style="font-weight:700;font-size:16px;padding:12px 0 4px;color:#0e2d5e">UKUPNO</td><td style="text-align:right;font-weight:700;font-size:16px;color:#1D9E75;padding:12px 0 4px">${d.totalPrice}€</td></tr>
      </table>
      <div style="font-size:12px;color:#9ca3af;margin-top:8px">Plaćanje gotovinom ili karticom pri preuzimanju vozila. Za karticu +3% bankarske usluge.</div>
    </div>

    ${accountSection}

    <div style="text-align:center;margin-top:20px">
      <a href="https://www.rent-cars.me/moje" style="display:inline-block;padding:12px 28px;background:#1a56a0;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px">Moje rezervacije →</a>
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
        <tr><td style="color:#666;padding:5px 0">Osiguranje</td><td style="text-align:right;padding:5px 0">${d.insurance || 'Osnovno (AO)'}</td></tr>
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
        ${d.days && d.pricePerDay ? `<tr><td style="color:#555;padding:5px 0;border-bottom:1px solid #d1fae5">Najam (${d.days} dana × ${d.pricePerDay}€)</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #d1fae5">${d.days * d.pricePerDay}€</td></tr>` : ''}
        ${d.insurance && d.insuranceTotal ? `<tr><td style="color:#555;padding:5px 0;border-bottom:1px solid #d1fae5">${d.insurance}</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #d1fae5">${d.insuranceTotal}€</td></tr>` : ''}
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
