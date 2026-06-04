-- Ajouter ical_url et kits par défaut aux clients conciergerie
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ical_url text,
  ADD COLUMN IF NOT EXISTS default_petit_kits integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_grand_kits integer DEFAULT 0;

-- Table des événements iCal synchronisés
CREATE TABLE IF NOT EXISTS ical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uid text NOT NULL,
  checkin_date date NOT NULL,
  checkout_date date NOT NULL,
  summary text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(client_id, uid)
);

ALTER TABLE ical_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full" ON ical_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
