-- linkedin_stage only applies to LinkedIn sends; enforce it so a non-linkedin row
-- can never carry a stage (data integrity for the sequence orchestrator).
ALTER TABLE scheduled_sends
  ADD CONSTRAINT scheduled_sends_linkedin_stage_channel
  CHECK (linkedin_stage IS NULL OR channel = 'linkedin');
