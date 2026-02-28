-- Migration to add columns that were mistakenly included in the initial schema
-- These fields were removed from 001_initial_schema when the migration
-- had already been applied in production.

ALTER TABLE cleaning
  ADD COLUMN sent_next_week_message BOOLEAN DEFAULT 0;

ALTER TABLE cleaning
  ADD COLUMN instruction_message_id TEXT;
