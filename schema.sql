-- ═══════════════════════════════════════════════════════════════════════
-- LBV App — Schéma Supabase
-- À exécuter dans : console.supabase.com → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════

-- ── TABLES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('conciergerie', 'residence')),
  billing_type text NOT NULL CHECK (billing_type IN ('weight', 'article')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  room text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'standard',
  sort_order integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kit_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_type text NOT NULL CHECK (kit_type IN ('petit', 'grand')),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  petit_kits integer DEFAULT 0,
  grand_kits integer DEFAULT 0,
  total_weight decimal(8,3),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles(id),
  resident_id uuid REFERENCES residents(id),
  quantity integer NOT NULL DEFAULT 1
);

-- ── SÉCURITÉ (RLS) ──────────────────────────────────────────────────────

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON residents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON articles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON kit_compositions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON deliveries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON delivery_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── DONNÉES INITIALES ────────────────────────────────────────────────────

-- Clients
INSERT INTO clients (name, type, billing_type) VALUES
  ('Conciergerie', 'conciergerie', 'weight'),
  ('Résidence Carnot-Blossac', 'residence', 'article'),
  ('Résidence JDA', 'residence', 'article');

-- Articles
INSERT INTO articles (name, category, sort_order) VALUES
  ('Housse couette 160', 'linge_lit', 1),
  ('Drap housse 160',    'linge_lit', 2),
  ('Housse couette 140', 'linge_lit', 3),
  ('Drap housse 140',    'linge_lit', 4),
  ('Taie d''oreiller',   'linge_lit', 5),
  ('Grande serviette',   'serviette', 6),
  ('Tapis de bain',      'salle_de_bain', 7),
  ('Torchon',            'cuisine', 8),
  ('Blouse',             'vetement', 9),
  ('Vêtement',           'vetement', 10);

-- Petit kit (2 personnes = lit 160)
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'petit', id, 1 FROM articles WHERE name = 'Housse couette 160';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'petit', id, 1 FROM articles WHERE name = 'Drap housse 160';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'petit', id, 2 FROM articles WHERE name = 'Taie d''oreiller';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'petit', id, 2 FROM articles WHERE name = 'Grande serviette';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'petit', id, 1 FROM articles WHERE name = 'Tapis de bain';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'petit', id, 1 FROM articles WHERE name = 'Torchon';

-- Grand kit (4 personnes = lit 160 + lit 140)
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 1 FROM articles WHERE name = 'Housse couette 160';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 1 FROM articles WHERE name = 'Drap housse 160';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 1 FROM articles WHERE name = 'Housse couette 140';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 1 FROM articles WHERE name = 'Drap housse 140';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 4 FROM articles WHERE name = 'Taie d''oreiller';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 4 FROM articles WHERE name = 'Grande serviette';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 1 FROM articles WHERE name = 'Tapis de bain';
INSERT INTO kit_compositions (kit_type, article_id, quantity)
  SELECT 'grand', id, 1 FROM articles WHERE name = 'Torchon';
