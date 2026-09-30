CREATE TABLE gyca_project_archives (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND length(slug)<=128),
  status text NOT NULL CHECK (status IN ('draft','published','archived')),
  revision integer NOT NULL CHECK (revision>0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'),
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  published_at timestamptz,
  CHECK (status<>'published' OR published_at IS NOT NULL)
);
CREATE INDEX gyca_project_archives_public ON gyca_project_archives(id) WHERE status='published';
CREATE TABLE gyca_archive_changes (
  archive_id uuid NOT NULL REFERENCES gyca_project_archives(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>0),
  status text NOT NULL CHECK (status IN ('draft','published','archived')),
  snapshot jsonb NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('created','edited','published','archived')),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(archive_id,revision)
);
CREATE TABLE gyca_archive_publications (
  archive_id uuid NOT NULL,
  revision integer NOT NULL,
  source_reference text NOT NULL CHECK (length(source_reference) BETWEEN 1 AND 500),
  rights_reference text NOT NULL CHECK (length(rights_reference) BETWEEN 1 AND 500),
  PRIMARY KEY(archive_id,revision),
  FOREIGN KEY(archive_id,revision) REFERENCES gyca_archive_changes(archive_id,revision) ON DELETE RESTRICT
);
CREATE TABLE gyca_archive_actions (
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,action_id)
);
CREATE TRIGGER gyca_archive_changes_immutable BEFORE UPDATE OR DELETE ON gyca_archive_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
CREATE TRIGGER gyca_archive_publications_immutable BEFORE UPDATE OR DELETE ON gyca_archive_publications
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
CREATE TRIGGER gyca_archive_actions_immutable BEFORE UPDATE OR DELETE ON gyca_archive_actions
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
CREATE FUNCTION gyca_preserve_archive_projection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.slug,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.slug,OLD.created_by,OLD.created_at)
    THEN RAISE EXCEPTION 'Archive identity is immutable'; END IF;
  IF OLD.status='archived' OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Archive revision is locked'; END IF;
  IF NOT EXISTS (SELECT 1 FROM gyca_archive_changes h WHERE h.archive_id=OLD.id AND h.revision=NEW.revision
      AND h.status=NEW.status AND h.snapshot=NEW.content AND h.created_at=NEW.updated_at)
    THEN RAISE EXCEPTION 'Archive change evidence required'; END IF;
  IF NEW.status='published' THEN
    IF OLD.status<>'draft' OR NEW.content IS DISTINCT FROM OLD.content OR NEW.published_at IS DISTINCT FROM NEW.updated_at
      OR NOT EXISTS (SELECT 1 FROM gyca_archive_publications p WHERE p.archive_id=OLD.id AND p.revision=NEW.revision)
      THEN RAISE EXCEPTION 'Archive publication evidence required'; END IF;
  ELSIF NEW.published_at IS DISTINCT FROM OLD.published_at THEN RAISE EXCEPTION 'Publication time cannot change here';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_archive_projection BEFORE UPDATE ON gyca_project_archives
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_archive_projection();
