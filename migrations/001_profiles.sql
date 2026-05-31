-- Migration 001 : table profiles pour gérer les rôles admin / client
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'client')),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne peut lire que son propre profil
CREATE POLICY "self_read" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Seul l'admin peut modifier les profils
-- (à créer manuellement dans Supabase pour l'instant)

-- ⚠️ Après avoir créé les users dans Supabase Auth, insérez leurs profils :
-- INSERT INTO profiles (id, role) VALUES ('<uuid-admin>', 'admin');
-- INSERT INTO profiles (id, role, client_id)
--   VALUES ('<uuid-conciergerie>', 'client', (SELECT id FROM clients WHERE name = 'Conciergerie'));
