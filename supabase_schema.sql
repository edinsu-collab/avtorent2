-- AvtoRent Supabase schema
-- Pokreni u SQL Editoru ako već nisi

CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  qr_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('economy','suv','premium','minivan','convertible')),
  price_per_day NUMERIC(10,2) NOT NULL,
  seats INTEGER NOT NULL DEFAULT 5,
  transmission TEXT NOT NULL DEFAULT 'manual' CHECK (transmission IN ('manual','automatic')),
  fuel_type TEXT NOT NULL DEFAULT 'petrol',
  features TEXT[] DEFAULT '{}',
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_code TEXT UNIQUE NOT NULL DEFAULT 'RES-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 99999)::TEXT, 5, '0'),
  vehicle_id UUID REFERENCES vehicles(id),
  partner_id UUID REFERENCES partners(id),
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  guest_nationality TEXT,
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  pickup_location TEXT NOT NULL,
  notes TEXT,
  total_price NUMERIC(10,2) NOT NULL,
  commission_amount NUMERIC(10,2),
  commission_percent NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  qr_source TEXT,
  language TEXT DEFAULT 'sr',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qr_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES partners(id),
  qr_code TEXT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  converted BOOLEAN DEFAULT false,
  reservation_id UUID REFERENCES reservations(id)
);

-- RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles_public" ON vehicles;
DROP POLICY IF EXISTS "partners_public" ON partners;
DROP POLICY IF EXISTS "reservations_insert" ON reservations;
DROP POLICY IF EXISTS "qr_scans_insert" ON qr_scans;
DROP POLICY IF EXISTS "reservations_read" ON reservations;
DROP POLICY IF EXISTS "qr_scans_read" ON qr_scans;
DROP POLICY IF EXISTS "partners_read" ON partners;
DROP POLICY IF EXISTS "vehicles_all" ON vehicles;

CREATE POLICY "vehicles_public" ON vehicles FOR SELECT USING (true);
CREATE POLICY "partners_public" ON partners FOR SELECT USING (true);
CREATE POLICY "reservations_insert" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "qr_scans_insert" ON qr_scans FOR INSERT WITH CHECK (true);
CREATE POLICY "reservations_read" ON reservations FOR SELECT USING (true);
CREATE POLICY "qr_scans_read" ON qr_scans FOR SELECT USING (true);
CREATE POLICY "partners_read" ON partners FOR ALL USING (true);
CREATE POLICY "vehicles_all" ON vehicles FOR ALL USING (true);

-- Demo podaci (preskoci ako već postoje)
INSERT INTO partners (name, contact_name, email, phone, commission_percent, qr_code)
SELECT 'Vila Jadran', 'Marko Nikolić', 'jadran@email.com', '+382 67 111 111', 12.00, 'AP-0001'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE qr_code = 'AP-0001');

INSERT INTO partners (name, contact_name, email, phone, commission_percent, qr_code)
SELECT 'Apartmani Sunce', 'Ana Kovač', 'sunce@email.com', '+382 68 222 222', 10.00, 'AP-0002'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE qr_code = 'AP-0002');

INSERT INTO vehicles (name, category, price_per_day, seats, transmission, features, year)
SELECT 'Volkswagen Golf', 'economy', 70.00, 5, 'manual', ARRAY['Klima','Bluetooth','USB'], 2022
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Volkswagen Golf');

INSERT INTO vehicles (name, category, price_per_day, seats, transmission, features, year)
SELECT 'Toyota RAV4', 'suv', 110.00, 5, 'automatic', ARRAY['Klima','4x4','GPS','Kamera'], 2023
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Toyota RAV4');

INSERT INTO vehicles (name, category, price_per_day, seats, transmission, features, year)
SELECT 'Mercedes E-klasa', 'premium', 160.00, 5, 'automatic', ARRAY['Klima','GPS','Kožni enterijer'], 2023
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Mercedes E-klasa');
