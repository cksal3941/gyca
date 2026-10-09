CREATE TABLE gyca_editorial_content (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug)<=128),
  category text NOT NULL CHECK (category IN ('notice','schedule','faq','news','press')),
  status text NOT NULL CHECK (status IN ('draft','published','archived')),
  revision integer NOT NULL CHECK (revision>0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'),
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  published_at timestamptz,
  CHECK (status<>'published' OR published_at IS NOT NULL)
);
CREATE INDEX gyca_editorial_content_public_page ON gyca_editorial_content(published_at DESC,id DESC)
  WHERE status='published';
CREATE INDEX gyca_editorial_content_admin_page ON gyca_editorial_content(status,category,id);

CREATE TABLE gyca_editorial_content_changes (
  content_id uuid NOT NULL REFERENCES gyca_editorial_content(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>0),
  status text NOT NULL CHECK (status IN ('draft','published','archived')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('created','edited','published','archived')),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(content_id,revision)
);
CREATE TRIGGER gyca_editorial_content_changes_immutable BEFORE UPDATE OR DELETE ON gyca_editorial_content_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_editorial_content_actions (
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response jsonb NOT NULL CHECK (jsonb_typeof(response)='object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,action_id)
);
CREATE TRIGGER gyca_editorial_content_actions_immutable BEFORE UPDATE OR DELETE ON gyca_editorial_content_actions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_preserve_editorial_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.slug,NEW.category,NEW.created_by,NEW.created_at) IS DISTINCT FROM
    ROW(OLD.id,OLD.slug,OLD.category,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'Editorial content identity is immutable';
  END IF;
  IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Editorial revision must advance by one'; END IF;
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'First publication time is immutable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM gyca_editorial_content_changes h WHERE h.content_id=OLD.id
    AND h.revision=NEW.revision AND h.status=NEW.status AND h.snapshot=NEW.content) THEN
    RAISE EXCEPTION 'Editorial projection requires history evidence';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_editorial_content_projection BEFORE UPDATE ON gyca_editorial_content
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_editorial_content();
