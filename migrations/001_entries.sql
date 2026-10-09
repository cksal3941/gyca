CREATE TABLE gyca_competitions (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  published boolean NOT NULL DEFAULT false,
  draft_enabled boolean NOT NULL DEFAULT false,
  opens_at timestamptz,
  closes_at timestamptz,
  CHECK (closes_at IS NULL OR opens_at IS NULL OR opens_at < closes_at)
);

CREATE TABLE gyca_entries (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'received', 'withdrawn', 'expired')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  participant jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(participant) = 'object'),
  work jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(work) = 'object'),
  guardian jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(guardian) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX gyca_entries_owner_page ON gyca_entries(owner_id, id);

CREATE TABLE gyca_entry_creation_keys (
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 128),
  competition_id text NOT NULL REFERENCES gyca_competitions(id),
  entry_id uuid NOT NULL REFERENCES gyca_entries(id) ON DELETE RESTRICT,
  PRIMARY KEY (owner_id, key)
);
