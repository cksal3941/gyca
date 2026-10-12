-- Competition pamphlet/poster images uploaded by organizers. Stored in the database (no object
-- storage is configured for public media) and served read-only at a content-addressed public URL.
CREATE TABLE gyca_competition_posters (
  competition_id text PRIMARY KEY REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  bytes bytea NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL,
  CHECK (octet_length(bytes) = byte_size)
);
