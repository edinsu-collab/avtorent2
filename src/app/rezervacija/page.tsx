'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RezervacijaModal, RezForm, VoziloOption, EMPTY_REZ_FORM, calcDana, calcUkupno, ModalPreporuka } from '@/lib/RezervacijaModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Rezervacija = {
  id: string; ref_code: string; guest_name: string; guest_email: string; guest_phone: string
  guest_nationality: string; pickup_date: string; return_date: string
  pickup_time: string; return_time: string; pickup_location: string; notes: string
  total_price: number; final_total: number | null; status: string; payment_status: string
  amount_paid: number; amount_debt: number; issued_at: string | null; issued_by: string | null
  closed_at: string | null; closed_by: string | null; agent_name: string | null
  created_at: string; vehicles: { name: string } | null; qr_source: string | null
  site_domain: string | null; partners: { name: string } | null
  assigned_vehicle_name: string | null; assigned_vehicle_plate: string | null
  guest_dob: string | null; guest_license: string | null
  insurance: string | null; border_crossing: string | null; flight_number: string | null
  extras_total: number | null; transfer_fee: number | null; dropoff_location: string | null
  has_second_driver: boolean | null; driver2_name: string | null; driver2_license: string | null
  license_url: string | null; vehicle_class: string | null
  payment_method: string | null
  license_deadline: string | null
  confirmation_token: string | null
  daily_status: string | null
}

type FleetVehicle = {
  id: number; license_plate: string; marka: string; model: string; year: number | null
  agregirani_2: string | null; fleet_status: string; lokacija: string
  vehicle_class: string | null
}

type KalendarRez = {
  br_tablica: string; od_datuma: string; do_datuma: string
}

type Preporuka = {
  vozilo: FleetVehicle
  rupa_od: string; rupa_do: string; rupa_dana: number
  score: number; razlog: string
}

type ClientData = {
  id: string; email: string; full_name: string | null; phone: string | null
  nationality: string | null; date_of_birth: string | null; address: string | null
  licence_number: string | null; licence_country: string | null
  licence_expiry: string | null; licence_image_url: string | null
  first_name: string | null; last_name: string | null
  jmbg: string | null; id_card_number: string | null; passport_number: string | null
  created_at: string
}

const ST: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#FAEEDA', color: '#633806', label: 'Na čekanju' },
  confirmed: { bg: '#E1F5EE', color: '#085041', label: 'Potvrđeno' },
  issued:    { bg: '#E6F1FB', color: '#0C447C', label: 'Izdato' },
  closed:    { bg: '#f3f4f6', color: '#374151', label: 'Zatvoreno' },
  cancelled: { bg: '#FCEBEB', color: '#791F1F', label: 'Otkazano' },
}

// Kalendar statusi iz rezervacije
function getKalendarStatus(r: Rezervacija): { label: string; bg: string; color: string } | null {
  if (!r.daily_status) return null
  if (String(r.daily_status).includes('Verifikovan')) return { label: '✅ Verifikovan — spreman', bg: '#E1F5EE', color: '#085041' }
  if (String(r.daily_status).includes('neverifikovan')) return { label: '⏳ Na čekanju — neverifikovan', bg: '#FAEEDA', color: '#633806' }
  return null
}

// Mapa lokacije → fleet region
const LOKACIJA_REGION: Record<string, string> = {
  'sarajevo': 'BiH', 'mostar': 'BiH', 'banja luka': 'BiH', 'tuzla': 'BiH',
  'bih': 'BiH', 'bosna': 'BiH',
  'beograd': 'SRBIJA', 'novi sad': 'SRBIJA', 'nis': 'SRBIJA', 'srbija': 'SRBIJA',
  'podgorica': 'CRNA GORA', 'budva': 'CRNA GORA', 'bar': 'CRNA GORA',
  'kotor': 'CRNA GORA', 'tivat': 'CRNA GORA', 'crna gora': 'CRNA GORA', 'montenegro': 'CRNA GORA',
  'tirana': 'ALBANIJA', 'albanija': 'ALBANIJA', 'albania': 'ALBANIJA',
}

function getRegionFromLocation(location: string): string | null {
  const l = location.toLowerCase()
  for (const [key, region] of Object.entries(LOKACIJA_REGION)) {
    if (l.includes(key)) return region
  }
  return null
}

function isRezComplete(r: Rezervacija): boolean {
  return !!(
    r.guest_name?.trim() &&
    r.guest_email?.trim() &&
    r.guest_phone?.trim() &&
    r.guest_nationality?.trim() &&
    r.guest_license?.trim() &&
    r.pickup_date &&
    r.return_date &&
    r.pickup_location?.trim()
    // Napomena: vozačka slika se provjerava u klijentskom profilu
  )
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function getLicenseStatus(r: { license_url: string | null; license_deadline: string | null; status: string }): { label: string; color: string; bg: string } | null {
  if (r.license_url) return null // ima vozačku — ok
  if (!r.license_deadline) return null
  const now = new Date()
  const deadline = new Date(r.license_deadline)
  const isExpired = now > deadline
  const minutesLeft = Math.round((deadline.getTime() - now.getTime()) / 60000)
  const hoursLeft = Math.round(minutesLeft / 60)
  if (isExpired) return { label: '⚠️ Fali vozačka', color: '#791F1F', bg: '#FCEBEB' }
  if (minutesLeft <= 60) return { label: `⏰ ${minutesLeft}min`, color: '#633806', bg: '#FAEEDA' }
  return { label: `📎 Rok: ${hoursLeft}h`, color: '#0C447C', bg: '#E6F1FB' }
}

function daysBetween(from: string, to: string): number {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000))
}

// Preporuka vozila — traži vozila iste klase sa rupom koja odgovara rezervaciji
// Izvuci transmission iz naziva vozila ili direktno
function getTransmissionFromName(name: string | null): 'automatic' | 'manual' | null {
  if (!name) return null
  const u = name.toUpperCase()
  if (u.includes('AUTOMATIC') || u.includes('AUTO')) return 'automatic'
  if (u.includes('MANUAL') || u.includes('MANUEL')) return 'manual'
  return null
}

// Srodne klase po prioritetu (isti mjenjač, slične klase)
const KLASA_SRODNE: Record<string, string[]> = {
  'Economy':    ['Economy', 'Hatchback', 'City'],
  'Hatchback':  ['Hatchback', 'Economy', 'City', 'Medium'],
  'City':       ['City', 'Economy', 'Hatchback'],
  'Medium':     ['Medium', 'Sedan', 'Hatchback'],
  'Sedan':      ['Sedan', 'Medium', 'Business'],
  'Business':   ['Business', 'Sedan', 'SUV'],
  'SUV':        ['SUV', 'Business', 'Crossover'],
  'Crossover':  ['Crossover', 'SUV', 'Medium'],
  'Minivan':    ['Minivan', 'SUV', 'Van'],
  'Van':        ['Van', 'Minivan'],
  'Pickup':     ['Pickup', 'SUV'],
}

function findPreporuke(
  trazenaDana: number,
  voznaKlasa: string | null,
  region: string | null,
  fleet: FleetVehicle[],
  kalendar: KalendarRez[],
  pickupDate: string,
  returnDate: string,
  trazenTransmission: 'automatic' | 'manual' | null
): Preporuka[] {
  const preporuke: Preporuka[] = []

  // Filtriraj vozila po regiji — klasu koristimo za scoring, ne za strogi filter
  const srodneKlase = voznaKlasa ? (KLASA_SRODNE[voznaKlasa] || [voznaKlasa]) : null
  const kandidati = fleet.filter(v => {
    const regionMatch = !region || v.lokacija === region
    // Prihvati ista klasa + srodne klase (za slučaj da nema tačnog pogotka)
    const klasaMatch = !srodneKlase || srodneKlase.includes(v.vehicle_class || '')
    return regionMatch && klasaMatch
  })

  for (const vozilo of kandidati) {
    // Provjeri da li je vozilo slobodno u traženom periodu
    const zauzeto = kalendar.some(k =>
      k.br_tablica === vozilo.license_plate &&
      k.od_datuma <= returnDate && k.do_datuma > pickupDate
    )
    if (zauzeto) continue

    // Nađi rezervacije za ovo vozilo sortirane po datumu
    const vozRez = kalendar
      .filter(k => k.br_tablica === vozilo.license_plate)
      .sort((a, b) => a.od_datuma.localeCompare(b.od_datuma))

    // Pronađi rupe u kalendaru
    // Rupa 1: od danas do prve rezervacije
    const buduceRez = vozRez.filter(k => k.do_datuma > pickupDate)

    let rupaDo: string
    if (buduceRez.length === 0) {
      // Nema budućih rezervacija — vozilo potpuno slobodno
      rupaDo = ''
      const rupaDana = 999
      const voziloTransFree = getTransmissionFromName(vozilo.agregirani_2)
      const istiMjenjacFree = !trazenTransmission || !voziloTransFree || trazenTransmission === voziloTransFree
      const istaKlasaFree = !voznaKlasa || vozilo.vehicle_class === voznaKlasa
      let scoreFree = istiMjenjacFree ? 60 : 35
      if (!istaKlasaFree) scoreFree -= 10
      preporuke.push({
        vozilo, rupa_od: pickupDate, rupa_do: 'bez ograničenja',
        rupa_dana: rupaDana, score: Math.max(0, scoreFree),
        razlog: `${istiMjenjacFree ? '✓ Isti mjenjač' : '⚠️ Drugi mjenjač'}${!istaKlasaFree ? ' · srodna klasa' : ''} · potpuno slobodno`
      })
    } else {
      // Ima budućih rezervacija — provjeri rupe između njih
      const prvaSljedeca = buduceRez[0]
      const rupaOd = pickupDate
      rupaDo = prvaSljedeca.od_datuma
      const rupaDana = daysBetween(rupaOd, rupaDo)

      if (rupaDana >= trazenaDana) {
        const viska = rupaDana - trazenaDana
        const voziloTrans = getTransmissionFromName(vozilo.agregirani_2)
        const isti_mjenjac = !trazenTransmission || !voziloTrans || trazenTransmission === voziloTrans
        const ista_klasa = !voznaKlasa || vozilo.vehicle_class === voznaKlasa

        // Scoring: mjenjač ima prioritet, pa klasa, pa rupa
        let score = viska === 0 ? 95 : viska <= 2 ? 85 : viska <= 5 ? 70 : 45
        if (isti_mjenjac) score += 5
        else score -= 20  // penalizuj različit mjenjač
        if (!ista_klasa) score -= 10  // srodna ali ne ista klasa

        const transLabel = voziloTrans === 'automatic' ? 'AUTOMATIC' : voziloTrans === 'manual' ? 'MANUAL' : ''
        const razlog = `${isti_mjenjac ? '✓ Isti mjenjač' : '⚠️ Drugi mjenjač'}${!ista_klasa ? ' · srodna klasa' : ''} · ${viska === 0 ? `tačno ${trazenaDana}d` : `rupa ${rupaDana}d`}`

        preporuke.push({
          vozilo, rupa_od: rupaOd, rupa_do: rupaDo,
          rupa_dana: rupaDana, score: Math.min(100, Math.max(0, score)),
          razlog
        })
      }

      // Provjeri rupe između svih rezervacija
      for (let i = 0; i < vozRez.length - 1; i++) {
        const krajPrve = vozRez[i].do_datuma
        const pocetakSljedece = vozRez[i + 1].od_datuma
        if (krajPrve <= pickupDate) continue // rupa je u prošlosti

        const rupaOd2 = krajPrve > pickupDate ? krajPrve : pickupDate
        const rupaDana2 = daysBetween(rupaOd2, pocetakSljedece)

        if (rupaDana2 >= trazenaDana && rupaOd2 <= returnDate) {
          const viska2 = rupaDana2 - trazenaDana
          const voziloTrans2 = getTransmissionFromName(vozilo.agregirani_2)
          const isti_mjenjac2 = !trazenTransmission || !voziloTrans2 || trazenTransmission === voziloTrans2
          const ista_klasa2 = !voznaKlasa || vozilo.vehicle_class === voznaKlasa
          let score2 = viska2 === 0 ? 95 : viska2 <= 2 ? 85 : viska2 <= 5 ? 70 : 45
          if (isti_mjenjac2) score2 += 5
          else score2 -= 20
          if (!ista_klasa2) score2 -= 10
          preporuke.push({
            vozilo, rupa_od: rupaOd2, rupa_do: pocetakSljedece,
            rupa_dana: rupaDana2, score: Math.min(100, Math.max(0, score2)),
            razlog: `${isti_mjenjac2 ? '✓ Isti mjenjač' : '⚠️ Drugi mjenjač'}${!ista_klasa2 ? ' · srodna klasa' : ''} · rupa između rez. ${rupaDana2}d`
          })
        }
      }
    }
  }

  // Sortiraj po score-u (bolje preporuke prve), ograniči na 5
  return preporuke
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

export default function AdminReservationsPage() {
  const [rezervacije, setRezervacije] = useState<Rezervacija[]>([])
  const [fleet, setFleet] = useState<FleetVehicle[]>([])
  const [vozila, setVozila] = useState<VoziloOption[]>([])
  const [kalendar, setKalendar] = useState<KalendarRez[]>([])
  const [rezExtrasMap, setRezExtrasMap] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Rezervacija | null>(null)
  const [preporuke, setPreporuke] = useState<Preporuka[]>([])
  const [loadingPrep, setLoadingPrep] = useState(false)

  // Nova/prebaci rezervacija modal
  const [showRezModal, setShowRezModal] = useState(false)
  const [rezForm, setRezForm] = useState<RezForm>(EMPTY_REZ_FORM)
  const [isNewRez, setIsNewRez] = useState(false)
  const [saving, setSaving] = useState(false)
  const [prebacujemId, setPrebacujemId] = useState<string | null>(null)

  // Otkaži
  const [cancelModal, setCancelModal] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Klijent modal
  const [clientModal, setClientModal] = useState<ClientData | null>(null)
  const [clientLoading, setClientLoading] = useState(false)
  const [clientEdit, setClientEdit] = useState(false)
  const [clientForm, setClientForm] = useState<Partial<ClientData>>({})
  const [clientSaving, setClientSaving] = useState(false)

  const agentName = getCookie('avtorent-agent-name')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: res }, { data: voz }, { data: kal }, { data: rezExtras }] = await Promise.all([
      supabase.from('reservations').select('*, partners(name)').order('created_at', { ascending: false }),
      supabase.from('vozila_fleet').select('id, license_plate, marka, model, year, agregirani_2, fleet_status, lokacija, vehicle_class').order('marka'),
      supabase.from('rezervacije').select('br_tablica, od_datuma, do_datuma').neq('daily_status', 'Nije izdato'),
      supabase.from('reservation_extras').select('reservation_id, extra_id, extra_name, price_per_unit, days, total_price, type'),
    ])

    const enriched = (res || []).map((r: any) => {
      const isNumeric = /^\d+$/.test(String(r.vehicle_id))
      if (isNumeric) {
        const v = (voz || []).find((v: any) => String(v.id) === String(r.vehicle_id))
        return { ...r, vehicles: v ? { name: v.agregirani_2 || `${v.marka} ${v.model}` } : null }
      }
      return { ...r, vehicles: r.vehicles || null }
    })

    setRezervacije(enriched)
    setFleet((voz || []).filter((v: any) => v.fleet_status === 'available'))
    setVozila((voz || []).filter((v: any) => v.fleet_status === 'available'))
    setKalendar(kal || [])
    // Grupiši extras po reservation_id
    const extrasMap: Record<string, any[]> = {}
    for (const e of (rezExtras || [])) {
      if (!extrasMap[e.reservation_id]) extrasMap[e.reservation_id] = []
      extrasMap[e.reservation_id].push(e)
    }
    setRezExtrasMap(extrasMap)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Kad se odabere rezervacija, generiši preporuke
  useEffect(() => {
    if (!selected) { setPreporuke([]); return }
    setLoadingPrep(true)

    const trazenaDana = daysBetween(selected.pickup_date, selected.return_date)
    const region = getRegionFromLocation(selected.pickup_location || '')
    const voznaKlasa = selected.vehicle_class || null

    const trazenTransmission = getTransmissionFromName(selected.assigned_vehicle_name)
    const prep = findPreporuke(
      trazenaDana, voznaKlasa, region, fleet, kalendar,
      selected.pickup_date, selected.return_date, trazenTransmission
    )
    setPreporuke(prep)
    setLoadingPrep(false)
  }, [selected, fleet, kalendar])

  function openNova() {
    setRezForm(EMPTY_REZ_FORM)
    setIsNewRez(true)
    setShowRezModal(true)
  }

  function openPrebaci(r: Rezervacija, predlozenaTableica?: string) {
    setPrebacujemId(r.id)
    const dana = daysBetween(r.pickup_date, r.return_date)
    const cijenaPoDay = dana > 0 ? Math.round((r.total_price || 0) / dana) : r.total_price || 0

    // Pokušaj naći tablice — prioritet: predložena > sačuvana > iz naziva vozila
    let resolvedPlate = predlozenaTableica || r.assigned_vehicle_plate || ''

    if (!resolvedPlate && r.assigned_vehicle_name) {
      // Tablica je često dio naziva npr. "VOLKSWAGEN TIGUAN PGNM026 2017"
      const words = r.assigned_vehicle_name.toUpperCase().split(/\s+/)
      const plateFromName = words.find(w =>
        fleet.some(v => v.license_plate.toUpperCase() === w)
      )
      if (plateFromName) {
        resolvedPlate = plateFromName
      } else {
        // Traži po marka+model podudaranju u floti
        const found = fleet.find(v => {
          const name = r.assigned_vehicle_name!.toLowerCase()
          return name.includes((v.marka || '').toLowerCase()) &&
                 name.includes((v.model || '').toLowerCase())
        })
        if (found) resolvedPlate = found.license_plate
      }
    }

    // Osiguranje iz rezervacije
    let tip_osiguranja = 'Osnovno (AO)'
    if (r.insurance === 'kasko_full' || r.insurance === 'Full Kasko') tip_osiguranja = 'Full Kasko'
    else if (r.insurance === 'kasko_ucesce' || r.insurance === 'Kasko sa učešćem') tip_osiguranja = 'Kasko sa učešćem'

    setRezForm({
      ...EMPTY_REZ_FORM,
      // Klijent
      ime_prezime: r.guest_name || '',
      telefon: r.guest_phone || '',
      email: r.guest_email || '',
      zemlja: r.guest_nationality || '',
      datum_rodjenja: r.guest_dob || '',
      br_vozacke: r.guest_license || '',
      licence_image_url: r.license_url || '',
      confirmation_token: r.confirmation_token || '',
      // Drugi vozač
      br_vozacke2: r.has_second_driver ? (r.driver2_license || '') : '',
      ime2: r.has_second_driver ? (r.driver2_name?.split(' ')[0] || '') : '',
      prezime2: r.has_second_driver ? (r.driver2_name?.split(' ').slice(1).join(' ') || '') : '',
      // Period
      od_datuma: r.pickup_date || '',
      do_datuma: r.return_date || '',
      vreme_izdavanja: r.pickup_time?.slice(0, 5) || '10:00',
      vreme_povratka: r.return_time?.slice(0, 5) || '10:00',
      // Cijena
      cijena_dan: cijenaPoDay,
      naplaceno: r.amount_paid || 0,
      nacin_placanja: r.payment_method || 'Keš',
      // Lokacije
      mjesto_preuzimanja: r.pickup_location || '',
      mjesto_povratka: r.dropoff_location || r.pickup_location || '',
      // Osiguranje
      tip_osiguranja,
      // Ostalo
      br_leta: r.flight_number || '',
      granica: r.border_crossing === 'forbidden' ? 'ZABRANJENO VAN ZEMLJE' : 'DOZVOLJENO VAN ZEMLJE',
      // Extras iz rezervacije — prenesi odabrane
      dostava_cijena: r.transfer_fee || 0,
      selected_extras: (rezExtrasMap[r.id] || []).map((e: any) => ({
        extraId: e.extra_id,
        extraName: e.extra_name,
        pricePerUnit: e.price_per_unit,
        days: e.days,
        totalPrice: e.total_price,
        type: e.type,
      })),
      napomena: [r.notes, `Sajt ref: ${r.ref_code}`].filter(Boolean).join(' | '),
      izvor_rezervacije: 'Sajt',
      daily_status: 'Na čekanju',
      br_tablica: resolvedPlate,
    })
    setIsNewRez(true)
    setShowRezModal(true)
  }

  async function saveRezervacija() {
    if (!rezForm.br_tablica || !rezForm.ime_prezime) {
      alert('Unesite tablice i ime!'); return
    }
    setSaving(true)
    const dana = calcDana(rezForm)
    const ukupno = calcUkupno(rezForm)
    const payload = {
      br_tablica: rezForm.br_tablica, ime_prezime: rezForm.ime_prezime,
      br_vozacke: rezForm.br_vozacke, daily_status: rezForm.daily_status || 'Na čekanju',
      od_datuma: rezForm.od_datuma, do_datuma: rezForm.do_datuma,
      vreme_izdavanja: rezForm.vreme_izdavanja, vreme_povratka: rezForm.vreme_povratka,
      cijena_dan: rezForm.cijena_dan, nacin_placanja: rezForm.nacin_placanja,
      firma: rezForm.firma, adresa: rezForm.adresa, telefon: rezForm.telefon,
      email: rezForm.email, zemlja: rezForm.zemlja, datum_rodjenja: rezForm.datum_rodjenja,
      tip_osiguranja: rezForm.tip_osiguranja, kasko_cijena: rezForm.kasko_cijena,
      kasko_tip: rezForm.kasko_tip, kasko_ucesce: rezForm.kasko_ucesce,
      granica: rezForm.granica, depozit: rezForm.depozit, napomena: rezForm.napomena,
      bebi_sic_cijena: rezForm.bebi_sic_cijena, dozvola_van_zemlje_cijena: rezForm.dozvola_van_zemlje_cijena,
      dostava_cijena: rezForm.dostava_cijena, dodatni_vozac_cijena: rezForm.dodatni_vozac_cijena,
      dodatni_vozac_vozacka: rezForm.br_vozacke2, br_leta: rezForm.br_leta,
      mjesto_preuzimanja: rezForm.mjesto_preuzimanja, mjesto_povratka: rezForm.mjesto_povratka,
      izvor_rezervacije: rezForm.izvor_rezervacije, ko_je_izdao: rezForm.ko_je_izdao || null,
      naplaceno: rezForm.naplaceno, ukupno_naplata: ukupno, broj_dana: dana,
    }
    await supabase.from('rezervacije').insert([payload])
    await supabase.from('logovi').insert([{ akcija: `Kreirana rezervacija za ${rezForm.ime_prezime} (${rezForm.br_tablica})` }])

    if (prebacujemId) {
      // Samo ažuriraj vozilo i napomenu — NE postavljaj issued_by
      const origRez = rezervacije.find(r => r.id === prebacujemId)
      const origVozilo = origRez?.vehicles?.name || origRez?.assigned_vehicle_name || ''
      const novoVozilo = rezForm.br_tablica
      const napomena = origVozilo
        ? `Prebačeno: ${origVozilo} → ${novoVozilo}`
        : `Dodjeljeno vozilo: ${novoVozilo}`
      await supabase.from('reservations').update({
        assigned_vehicle_plate: novoVozilo,
        assigned_vehicle_name: vozila.find(v => v.license_plate === novoVozilo)?.agregirani_2 || novoVozilo,
        notes: origRez?.notes ? `${origRez.notes} | ${napomena}` : napomena,
      }).eq('id', prebacujemId)
      setPrebacujemId(null)
    }

    setSaving(false)
    setShowRezModal(false)
    setRezForm(EMPTY_REZ_FORM)
    setSelected(null)
    loadData()
  }

  async function handleCancel() {
    if (!cancelModal || !cancelReason.trim()) return
    await supabase.from('reservations').update({
      status: 'cancelled', closed_by: agentName || 'Agent',
      closed_at: new Date().toISOString(), notes: cancelReason.trim(),
    }).eq('id', cancelModal)
    setCancelModal(null); setCancelReason(''); loadData()
  }

  async function openClient(email: string) {
    if (!email) return
    setClientLoading(true)
    setClientEdit(false)
    const { data } = await supabase.from('clients').select('*').eq('email', email).single()
    if (data) {
      // Auto-popuni ime/prezime iz full_name ako su prazni
      let enriched = { ...data }
      if (!enriched.first_name && !enriched.last_name && enriched.full_name) {
        const parts = enriched.full_name.trim().split(/\s+/)
        enriched.first_name = parts[0] || ''
        enriched.last_name = parts.slice(1).join(' ') || ''
      }
      setClientModal(enriched)
      setClientForm(enriched)
    } else {
      alert('Klijent nije pronađen u bazi.')
    }
    setClientLoading(false)
  }

  async function saveClient() {
    if (!clientModal) return
    setClientSaving(true)
    // Auto-generate full_name from first+last
    const updates = {
      ...clientForm,
      full_name: [clientForm.first_name, clientForm.last_name].filter(Boolean).join(' ') || clientForm.full_name || clientModal.full_name,
    }
    await fetch('/api/client-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientModal.id, updates }),
    })
    setClientModal({ ...clientModal, ...updates } as ClientData)
    setClientEdit(false)
    setClientSaving(false)
  }

  const filtered = rezervacije.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return r.guest_name?.toLowerCase().includes(q) ||
        r.ref_code?.toLowerCase().includes(q) ||
        r.guest_phone?.includes(q)
    }
    return true
  })

  const noviCount = rezervacije.filter(r => r.status === 'pending').length

  const inp: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', color: '#111' }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111', margin: 0 }}>Rezervacije</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            {filtered.length} prikazano
            {noviCount > 0 && <span style={{ marginLeft: 8, background: '#FAEEDA', color: '#633806', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>🆕 {noviCount} novih</span>}
          </p>
        </div>
        <button onClick={openNova} style={{ padding: '9px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nova rezervacija
        </button>
      </div>

      {/* FILTERI */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inp}>
          <option value="all">Svi statusi</option>
          <option value="pending">⏳ Na čekanju</option>
          <option value="confirmed">✅ Potvrđeno</option>
          <option value="issued">📅 Prebačeno</option>
          <option value="closed">Zatvoreno</option>
          <option value="cancelled">Otkazano</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pretraži ime, ref, telefon..."
          style={{ ...inp, width: 240 }} />
      </div>

      {/* TABELA + DETAIL PANEL */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>

        {/* TABELA */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Učitavanje...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Ref', 'Gost', 'Vozilo / Klasa', 'Period', 'Lokacija', 'Iznos', 'Status', 'Izvor / Agent', 'Akcije'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const st = ST[r.status] || ST.pending
                  const isNew = r.status === 'pending'
                  return (
                    <tr key={r.id}
                      onClick={() => { setSelected(selected?.id === r.id ? null : r); openPrebaci(r) }}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === r.id ? '#f0fdf8' : isNew ? '#fffbeb' : 'transparent', borderLeft: isNew ? '3px solid #f59e0b' : '3px solid transparent' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{r.ref_code}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div
                          style={{ fontWeight: 500, color: '#111', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}
                          onClick={e => { e.stopPropagation(); openClient(r.guest_email) }}
                          title="Klikni za profil klijenta"
                        >{r.guest_name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.guest_phone}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
                          {r.assigned_vehicle_name || r.vehicles?.name || '—'}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginTop: 2 }}>
                          {r.vehicle_class && <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>{r.vehicle_class}</span>}
                          {r.assigned_vehicle_plate && <span style={{ fontSize: 10, background: '#f3f4f6', color: '#6b7280', padding: '1px 6px', borderRadius: 20, fontFamily: 'monospace' }}>{r.assigned_vehicle_plate}</span>}
                        </div>
                        {r.notes?.includes('Prebačeno:') && (
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' }}>
                            {r.notes.split('|').find((n: string) => n.includes('Prebačeno:'))?.trim()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' as const }}>
                        {r.pickup_date}<br />{r.return_date}
                        <div style={{ fontSize: 10, color: '#d1d5db' }}>{daysBetween(r.pickup_date, r.return_date)} dana</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#6b7280', maxWidth: 120 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.pickup_location}</div>
                        {getRegionFromLocation(r.pickup_location || '') && (
                          <span style={{ fontSize: 10, background: '#FAEEDA', color: '#854F0B', padding: '1px 5px', borderRadius: 20 }}>
                            {getRegionFromLocation(r.pickup_location || '')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1D9E75', whiteSpace: 'nowrap' as const }}>{r.total_price}€</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '3px 8px', borderRadius: 20, fontWeight: 500 }}>{st.label}</span>
                        {(() => { const ls = getLicenseStatus(r); return ls ? <span style={{ fontSize: 10, background: ls.bg, color: ls.color, padding: '2px 6px', borderRadius: 20, fontWeight: 600, display: 'block', marginTop: 3 }}>{ls.label}</span> : null })()}
                        {isRezComplete(r)
                          ? <span style={{ fontSize: 10, background: '#E1F5EE', color: '#085041', padding: '2px 6px', borderRadius: 20, fontWeight: 600, display: 'block', marginTop: 3 }}>✅ Potpuna</span>
                          : <span style={{ fontSize: 10, background: '#FAEEDA', color: '#633806', padding: '2px 6px', borderRadius: 20, fontWeight: 600, display: 'block', marginTop: 3 }}>⚠️ Nepotpuna</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.qr_source
                          ? <span style={{ fontSize: 10, background: '#FAEEDA', color: '#854F0B', padding: '1px 6px', borderRadius: 20, display: 'block', marginBottom: 2 }}>{r.partners?.name || r.qr_source}</span>
                          : r.site_domain
                          ? <span style={{ fontSize: 10, background: '#E6F1FB', color: '#0C447C', padding: '1px 6px', borderRadius: 20, display: 'block', marginBottom: 2 }}>{r.site_domain}</span>
                          : <span style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Direktno</span>}
                        {r.issued_by && (
                          <div>
                            <span style={{ fontSize: 10, background: '#E1F5EE', color: '#085041', padding: '1px 6px', borderRadius: 20, fontWeight: 600, display: 'block' }}>🚗 {r.issued_by}</span>
                            {r.issued_at && <span style={{ fontSize: 9, color: '#9ca3af' }}>{new Date(r.issued_at).toLocaleDateString('sr-RS')}</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>

                          {(r.status === 'pending' || r.status === 'confirmed') && (
                            <button onClick={() => { setCancelModal(r.id); setCancelReason('') }}
                              style={{ padding: '4px 8px', fontSize: 11, border: '1px solid #fecaca', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#dc2626' }}>
                              Otkaži
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Nema rezervacija.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* DETAIL PANEL */}
        {selected && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', alignSelf: 'start', maxHeight: '90vh', overflowY: 'auto' as const, position: 'sticky' as const, top: 16 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.guest_name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{selected.ref_code}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ padding: '14px 16px' }}>

              {/* Izdao info */}
              {selected.issued_by && (
                <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#085041', marginBottom: 2 }}>🚗 Vozilo izdao: {selected.issued_by}</div>
                  {selected.issued_at && <div style={{ fontSize: 11, color: '#374151' }}>{new Date(selected.issued_at).toLocaleString('sr-RS')}</div>}
                </div>
              )}

              {/* Vozačka + brzi linkovi */}
              {!selected.license_url && selected.status !== 'cancelled' && selected.status !== 'closed' && (
                <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                    {getLicenseStatus(selected)?.label || '📎 Fali vozačka dozvola'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <button onClick={() => {
                      const link = `${window.location.origin}/potvrda/${selected.confirmation_token}`
                      navigator.clipboard.writeText(link)
                      alert('Link kopiran!')
                    }} style={{ flex: 1, padding: '7px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      📋 Kopiraj link
                    </button>
                    <a href={`https://wa.me/${selected.guest_phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Poštovani ${selected.guest_name},

Vaša rezervacija ${selected.ref_code} je primljena.

Molimo uploadujte vozačku dozvolu kako bismo pripremili ugovor:
${window.location.origin}/potvrda/${selected.confirmation_token}`)}`}
                      target="_blank" rel="noreferrer"
                      style={{ flex: 1, padding: '7px', background: '#25D366', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const, display: 'block' }}>
                      💬 WhatsApp
                    </a>
                  </div>
                  {!isRezComplete(selected) && (
                    <div style={{ fontSize: 10, color: '#92400e', background: '#fef3c7', borderRadius: 5, padding: '4px 8px' }}>
                      ⚠️ Nepotpuna — fali: {[
                        !selected.guest_name?.trim() && 'ime',
                        !selected.guest_email?.trim() && 'email',
                        !selected.guest_phone?.trim() && 'telefon',
                        !selected.guest_nationality?.trim() && 'nacionalnost',
                        !selected.guest_license?.trim() && 'br. vozačke',
                        !selected.license_url && 'slika vozačke',
                      ].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              )}
              {selected.license_url && (
                <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#085041' }}>✅ Vozačka uploadovana</div>
                    <a href={selected.license_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#085041', textDecoration: 'none', fontWeight: 600 }}>📄 Otvori →</a>
                  </div>
                </div>
              )}

              {/* Dugme za klijent profil */}
              <button onClick={() => openClient(selected.guest_email)}
                style={{ width: '100%', padding: '8px', marginBottom: 14, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                👤 Profil klijenta u bazi
              </button>

              {/* Podaci klijenta */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase' as const }}>Klijent</div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                {[['Ime', selected.guest_name], ['Email', selected.guest_email], ['Telefon', selected.guest_phone], ['Nacionalnost', selected.guest_nationality], ['Datum rođenja', selected.guest_dob], ['Br. vozačke', selected.guest_license]].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#9ca3af' }}>{l}</span><span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Detalji */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase' as const }}>Rezervacija</div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                {[['Period', `${selected.pickup_date} → ${selected.return_date}`], ['Dana', String(daysBetween(selected.pickup_date, selected.return_date))], ['Preuzimanje', selected.pickup_location], ['Vraćanje', selected.dropoff_location || selected.pickup_location], ['Klasa', selected.vehicle_class], ['Osiguranje', selected.insurance], ['Granica', selected.border_crossing], ['Broj leta', selected.flight_number], ['Iznos', `${selected.total_price}€`]].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#9ca3af' }}>{l}</span><span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* PREPORUKE */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#185FA5', marginBottom: 8, textTransform: 'uppercase' as const }}>🤖 Preporuke sistema</div>
              {loadingPrep ? (
                <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' as const, padding: 12 }}>Analiziram...</div>
              ) : preporuke.length === 0 ? (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Nema slobodnih vozila iste klase.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 12 }}>
                  {preporuke.map((p, i) => (
                    <div key={p.vozilo.license_plate + i}
                      style={{ background: p.score >= 90 ? '#E1F5EE' : p.score >= 75 ? '#E6F1FB' : '#f9fafb', border: `1px solid ${p.score >= 90 ? '#1D9E75' : p.score >= 75 ? '#85B7EB' : '#e5e7eb'}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{p.vozilo.agregirani_2 || `${p.vozilo.marka} ${p.vozilo.model}`}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.vozilo.license_plate} · {p.vozilo.lokacija}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: p.score >= 90 ? '#1D9E75' : p.score >= 75 ? '#185FA5' : '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>{p.score}%</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>📅 {p.rupa_od} → {p.rupa_do === 'bez ograničenja' ? '∞' : p.rupa_do} ({p.rupa_dana === 999 ? '∞' : p.rupa_dana}d)</div>
                      <div style={{ fontSize: 11, color: '#374151', marginBottom: 8, fontStyle: 'italic' }}>💡 {p.razlog}</div>
                      <button onClick={() => openPrebaci(selected, p.vozilo.license_plate)}
                        style={{ width: '100%', padding: '6px', background: p.score >= 90 ? '#1D9E75' : '#185FA5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ✓ Koristi ovo vozilo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* REZ MODAL */}
      {showRezModal && (
        <RezervacijaModal
          form={rezForm} setForm={setRezForm} vozila={vozila}
          onSave={saveRezervacija}
          onClose={() => { setShowRezModal(false); setRezForm(EMPTY_REZ_FORM); setPrebacujemId(null); setSelected(null) }}
          saving={saving} isNew={isNewRez}
          title={selected ? `${selected.ref_code} · ${isRezComplete(selected) ? '✅ Potpuna' : '⚠️ Nepotpuna'}${selected.issued_by ? ` · 🚗 ${selected.issued_by}` : ''}` : 'Nova rezervacija'}
          preporuke={preporuke.map(p => ({
            licencePlate: p.vozilo.license_plate,
            naziv: p.vozilo.agregirani_2 || `${p.vozilo.marka} ${p.vozilo.model}`,
            lokacija: p.vozilo.lokacija,
            score: p.score,
            rupaDana: p.rupa_dana,
            rupaDo: p.rupa_do,
            razlog: p.razlog,
          }))}
          loadingPrep={loadingPrep}
        />
      )}



      {/* KLIJENT MODAL */}
      {clientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  👤 {[clientModal.first_name, clientModal.last_name].filter(Boolean).join(' ') || clientModal.full_name || clientModal.email}
                </div>
                <div style={{ fontSize: 12, color: '#185FA5', fontWeight: 500 }}>{clientModal.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!clientEdit && (
                  <button onClick={() => setClientEdit(true)}
                    style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
                    ✏️ Uredi
                  </button>
                )}
                <button onClick={() => { setClientModal(null); setClientEdit(false) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Vozačka status */}
              {clientModal.licence_image_url ? (
                <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: 8, padding: '10px 12px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#085041' }}>✅ Vozačka dozvola uploadovana</div>
                  <a href={clientModal.licence_image_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#085041', fontWeight: 600, textDecoration: 'none' }}>📄 Otvori →</a>
                </div>
              ) : (
                <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>⚠️ Vozačka dozvola nije uploadovana</div>
                </div>
              )}

              {clientEdit ? (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {/* Email — readonly */}
                  <div>
                    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Email</label>
                    <input type="text" value={clientModal.email} disabled
                      style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', boxSizing: 'border-box' as const, background: '#f9fafb' }} />
                  </div>
                  {[
                    ['Ime', 'first_name', 'text'],
                    ['Prezime', 'last_name', 'text'],
                    ['Telefon', 'phone', 'text'],
                    ['Datum rođenja', 'date_of_birth', 'date'],
                    ['Nacionalnost', 'nationality', 'text'],
                    ['Adresa', 'address', 'text'],
                    ['Br. vozačke', 'licence_number', 'text'],
                    ['Zemlja vozačke', 'licence_country', 'text'],
                    ['Istek vozačke', 'licence_expiry', 'date'],
                    ['JMBG', 'jmbg', 'text'],
                    ['Br. lične karte', 'id_card_number', 'text'],
                    ['Br. pasoša', 'passport_number', 'text'],
                  ].map(([label, field, type]) => (
                    <div key={field}>
                      <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{label}</label>
                      <input type={type}
                        value={(clientForm as any)[field] || ''}
                        onChange={e => setClientForm(f => ({ ...f, [field]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, color: '#111', boxSizing: 'border-box' as const }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    <button onClick={() => setClientEdit(false)}
                      style={{ flex: 1, padding: '11px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
                      Odustani
                    </button>
                    <button onClick={saveClient} disabled={clientSaving}
                      style={{ flex: 2, padding: '11px', background: clientSaving ? '#9ca3af' : 'linear-gradient(135deg, #1D9E75, #0e7a5a)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(29,158,117,0.3)' }}>
                      {clientSaving ? '⏳ Snimanje...' : '💾 Sačuvaj izmjene'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
                  {[
                    ['Ime', clientModal.first_name],
                    ['Prezime', clientModal.last_name],
                    ['Puno ime', clientModal.full_name],
                    ['Telefon', clientModal.phone],
                    ['Datum rođenja', clientModal.date_of_birth],
                    ['Nacionalnost', clientModal.nationality],
                    ['Adresa', clientModal.address],
                    ['Br. vozačke', clientModal.licence_number],
                    ['Zemlja vozačke', clientModal.licence_country],
                    ['Istek vozačke', clientModal.licence_expiry],
                    ['JMBG', clientModal.jmbg],
                    ['Br. lične karte', clientModal.id_card_number],
                    ['Br. pasoša', clientModal.passport_number],
                    ['Član od', clientModal.created_at ? new Date(clientModal.created_at).toLocaleDateString('sr-RS') : null],
                  ].map(([l, v]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span style={{ color: '#6b7280' }}>{l}</span>
                      <span style={{ color: v ? '#111' : '#d1d5db', fontWeight: v ? 500 : 400 }}>{v || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Otkazivanje</div>
            <label style={lbl}>Razlog *</label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Klijent otkazao..."
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, minHeight: 80, resize: 'vertical' as const, color: '#111', boxSizing: 'border-box' as const, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCancel} disabled={!cancelReason.trim()}
                style={{ flex: 2, padding: 10, background: !cancelReason.trim() ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Otkaži rezervaciju
              </button>
              <button onClick={() => { setCancelModal(null); setCancelReason('') }}
                style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Nazad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
