CREATE INDEX gyca_entries_competition_created_idx
  ON gyca_entries(competition_id, created_at DESC, id DESC);
CREATE INDEX gyca_entries_competition_status_idx
  ON gyca_entries(competition_id, status);
CREATE INDEX gyca_entries_competition_review_idx
  ON gyca_entries(competition_id, review_status);
CREATE INDEX gyca_entries_competition_result_idx
  ON gyca_entries(competition_id, published_result);
