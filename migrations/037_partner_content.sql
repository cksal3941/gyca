CREATE TABLE gyca_partners (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug)<=128),
  partner_type text NOT NULL CHECK (partner_type IN ('organizer','international_program_partner','venue','cultural_partner','publishing_partner','educational_partner')),
  status text NOT NULL CHECK (status IN ('draft','published','archived')),
  relationship_status text NOT NULL CHECK (relationship_status IN ('pending','confirmed','revoked')),
  revision integer NOT NULL CHECK (revision>0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'),
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  published_at timestamptz,
  CHECK (status<>'published' OR (relationship_status='confirmed' AND published_at IS NOT NULL)),
  CHECK (relationship_status<>'revoked' OR status='archived')
);
CREATE INDEX gyca_partners_public_page ON gyca_partners(partner_type,id) WHERE status='published' AND relationship_status='confirmed';
CREATE INDEX gyca_partners_admin_page ON gyca_partners(status,relationship_status,id);

CREATE TABLE gyca_partner_changes (
  partner_id uuid NOT NULL REFERENCES gyca_partners(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>0),
  status text NOT NULL CHECK (status IN ('draft','published','archived')),
  relationship_status text NOT NULL CHECK (relationship_status IN ('pending','confirmed','revoked')),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('created','edited','relationship_confirmed','published','archived','relationship_revoked')),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(partner_id,revision)
);
CREATE TRIGGER gyca_partner_changes_immutable BEFORE UPDATE OR DELETE ON gyca_partner_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_partner_relationship_events (
  partner_id uuid NOT NULL REFERENCES gyca_partners(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>1),
  relationship_status text NOT NULL CHECK (relationship_status IN ('confirmed','revoked')),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL CHECK (length(evidence_reference) BETWEEN 1 AND 500),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(partner_id,revision)
);
CREATE TRIGGER gyca_partner_relationship_events_immutable BEFORE UPDATE OR DELETE ON gyca_partner_relationship_events
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE TABLE gyca_partner_actions (
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response jsonb NOT NULL CHECK (jsonb_typeof(response)='object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,action_id)
);
CREATE TRIGGER gyca_partner_actions_immutable BEFORE UPDATE OR DELETE ON gyca_partner_actions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();

CREATE FUNCTION gyca_preserve_partner_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.slug,NEW.partner_type,NEW.created_by,NEW.created_at) IS DISTINCT FROM
    ROW(OLD.id,OLD.slug,OLD.partner_type,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Partner identity is immutable'; END IF;
  IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Partner revision must advance by one'; END IF;
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'Partner first publication time is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM gyca_partner_changes h WHERE h.partner_id=OLD.id AND h.revision=NEW.revision
    AND h.status=NEW.status AND h.relationship_status=NEW.relationship_status AND h.snapshot=NEW.content) THEN
    RAISE EXCEPTION 'Partner projection requires history evidence'; END IF;
  IF NEW.relationship_status IS DISTINCT FROM OLD.relationship_status AND NOT EXISTS (
    SELECT 1 FROM gyca_partner_relationship_events e WHERE e.partner_id=OLD.id AND e.revision=NEW.revision
      AND e.relationship_status=NEW.relationship_status) THEN RAISE EXCEPTION 'Partner relationship requires evidence'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_partner_projection BEFORE UPDATE ON gyca_partners FOR EACH ROW EXECUTE FUNCTION gyca_preserve_partner_projection();
