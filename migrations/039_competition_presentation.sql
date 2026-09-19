CREATE TABLE gyca_competition_presentations (
  competition_id text PRIMARY KEY REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'),
  updated_at timestamptz NOT NULL
);
CREATE TABLE gyca_competition_presentation_changes (
  competition_id text NOT NULL REFERENCES gyca_competitions(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision>0),
  content jsonb NOT NULL CHECK (jsonb_typeof(content)='object'),
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL CHECK (length(evidence_reference) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(competition_id,revision)
);
CREATE TRIGGER gyca_competition_presentation_changes_immutable BEFORE UPDATE OR DELETE ON gyca_competition_presentation_changes
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_submission();
CREATE FUNCTION gyca_preserve_competition_presentation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.competition_id IS DISTINCT FROM OLD.competition_id OR NEW.revision<>OLD.revision+1
      THEN RAISE EXCEPTION 'Presentation revision must advance by one'; END IF;
  ELSIF NEW.revision<>1 THEN RAISE EXCEPTION 'Presentation must start at revision one'; END IF;
  IF NOT EXISTS (SELECT 1 FROM gyca_competition_presentation_changes h WHERE h.competition_id=NEW.competition_id
      AND h.revision=NEW.revision AND h.content=NEW.content AND h.created_at=NEW.updated_at)
    THEN RAISE EXCEPTION 'Presentation requires evidence'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gyca_competition_presentation_projection BEFORE INSERT OR UPDATE ON gyca_competition_presentations
  FOR EACH ROW EXECUTE FUNCTION gyca_preserve_competition_presentation();
