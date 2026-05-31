-- Migration 002 : statut livraison + table demandes conciergerie
-- À exécuter dans Supabase SQL Editor

-- Statut sur les livraisons
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'delivered'
  CHECK (status IN ('delivered', 'confirmed'));

-- Table des demandes / préventions de la conciergerie
CREATE TABLE IF NOT EXISTS delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  petit_kits integer DEFAULT 0,
  grand_kits integer DEFAULT 0,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'seen', 'done')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access" ON delivery_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
