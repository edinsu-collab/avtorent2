export function guestEmail(d: {
  guestName: string; vehicleName: string; pickupDate: string; returnDate: string
  pickupLocation: string; totalPrice: number; refCode: string; lang: string
  isNewClient?: boolean; tempPassword?: string | null; siteUrl?: string
}) {
  const subject = d.lang === 'en' ? `Reservation ${d.refCode}` : d.lang === 'de' ? `Reservierung ${d.refCode}` : `Rezervacija ${d.refCode}`

  const accountSection = d.isNewClient && d.tempPassword ? `
    <div style="background:#E1F5EE;border:1px solid #5DCAA5;border-radius:10px;padding:20px;margin:20px 0;text-align:center">
      <div style="font-size:15px;font-weight:bold;color:#085041;margin-bottom:8px">🎉 Vaš nalog je kreiran!</div>
      <div style="font-size:13px;color:#085041;margin-bottom:14px">Možete pratiti sve vaše rezervacije na jednom mjestu.</div>
      <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:14px;display:inline-block">
        <div style="font-size:12px;color:#9ca3af;margin-bottom:4px">Privremena lozinka</div>
        <div style="font-size:20px;font-weight:bold;font-family:monospace;color:#1D9E75;letter-spacing:2px">${d.tempPassword}</div>
      </div>
      <div style="margin-top:4px">
        <a href="${d.siteUrl}/moje/login" style="display:inline-block;padding:10px 22px;background:#1D9E75;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px">
          Prijavite se na vaš nalog →
        </a>
      </div>
      <div style="font-size:11px;color:#9ca3af;margin-top:10px">Preporučujemo da promijenite lozinku pri prvoj prijavi.</div>
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#333">
  <div style="background:#1D9E75;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:20px">AvtoRent Montenegro</h1>
  </div>
  <div style="padding:28px 24px">
    <p>Poštovani/a <strong>${d.guestName}</strong>,</p>
    <p>Primili smo vaš zahtjev za rezervaciju vozila <strong>${d.vehicleName}</strong>. Kontaktiraćemo vas u roku od 1 sata za potvrdu.</p>

    <div style="background:#f5f5f5;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
      <div style="font-size:13px;color:#666;margin-bottom:6px">Referentni broj</div>
      <div style="font-size:22px;font-weight:bold;font-family:monospace;color:#1D9E75">${d.refCode}</div>
    </div>

    <table style="width:100%;font-size:14px">
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Vozilo</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.vehicleName}</td></tr>
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Preuzimanje</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.pickupDate}</td></tr>
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Vraćanje</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.returnDate}</td></tr>
      <tr><td style="color:#666;padding:6px 0;border-bottom:1px solid #eee">Lokacija</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${d.pickupLocation}</td></tr>
      <tr><td style="font-weight:bold;padding:10px 0">Ukupno</td><td style="text-align:right;font-weight:bold;color:#1D9E75;padding:10px 0">${d.totalPrice}€</td></tr>
    </table>

    ${accountSection}

    <p style="font-size:13px;color:#666">Plaćanje se vrši gotovinom pri preuzimanju vozila. Depozit od 300€ je obavezan.</p>
  </div>
  <div style="background:#f9f9f9;padding:16px 24px;text-align:center;font-size:12px;color:#999">
    AvtoRent Montenegro · info@avtorent.me
  </div>
</body>
</html>`

  return { subject, html }
}

export function adminEmail(d: {
  refCode: string; guestName: string; guestEmail: string; guestPhone: string
  vehicleName: string; pickupDate: string; returnDate: string; pickupLocation: string
  totalPrice: number; partnerName?: string; commissionAmount?: number
  qrSource?: string; notes?: string
}) {
  const subject = `🚗 Nova rezervacija ${d.refCode} — ${d.guestName}`
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#0F6E56;padding:20px">
    <h1 style="color:#fff;margin:0;font-size:16px">Nova rezervacija — ${d.refCode}</h1>
  </div>
  <div style="padding:24px">
    <h3 style="margin:0 0 12px">Gost</h3>
    <table style="width:100%;font-size:14px">
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Ime</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestName}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Email</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestEmail}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Telefon</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.guestPhone}</td></tr>
    </table>
    <h3 style="margin:16px 0 12px">Rezervacija</h3>
    <table style="width:100%;font-size:14px">
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Vozilo</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.vehicleName}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Preuzimanje</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.pickupDate}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Vraćanje</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.returnDate}</td></tr>
      <tr><td style="color:#666;padding:5px 0;border-bottom:1px solid #eee">Lokacija</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #eee">${d.pickupLocation}</td></tr>
      <tr><td style="font-weight:bold;padding:10px 0">Ukupno</td><td style="text-align:right;font-weight:bold;color:#1D9E75;padding:10px 0">${d.totalPrice}€</td></tr>
    </table>
    ${d.partnerName ? `<div style="background:#FAEEDA;border:1px solid #EF9F27;border-radius:8px;padding:14px;margin-top:16px"><strong>Izvor (QR): ${d.partnerName}</strong><br><span style="font-size:13px">Provizija: ${d.commissionAmount?.toFixed(2)}€ · QR: ${d.qrSource}</span></div>` : ''}
    ${d.notes ? `<div style="margin-top:12px;padding:12px;background:#f5f5f5;border-radius:8px;font-size:13px"><strong>Napomena:</strong> ${d.notes}</div>` : ''}
  </div>
</body>
</html>`
  return { subject, html }
}
