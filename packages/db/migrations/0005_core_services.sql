-- Core services: Lead Pipeline, Aspire, LinkedIn Automation
-- Prerequisite: run 0005_add_linkedin_channel.sql first (enum value must commit separately).

CREATE TYPE "lifecycle_stage" AS ENUM ('prospect', 'active_client', 'churned');
CREATE TYPE "lead_source" AS ENUM ('linkedin', 'aspire', 'manual', 'csv', 'form', 'referral');
CREATE TYPE "relationship_status" AS ENUM (
  'new', 'contacted', 'connected', 'nurturing', 'qualified',
  'discovery_booked', 'proposal_sent', 'won', 'lost'
);
CREATE TYPE "linkedin_campaign_status" AS ENUM ('active', 'paused', 'completed');
CREATE TYPE "sequence_step_status" AS ENUM ('pending', 'sent', 'failed', 'skipped', 'cancelled');

ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "lifecycle_stage" "lifecycle_stage" NOT NULL DEFAULT 'active_client',
  ADD COLUMN IF NOT EXISTS "company" varchar(255),
  ADD COLUMN IF NOT EXISTS "job_title" varchar(255),
  ADD COLUMN IF NOT EXISTS "linkedin_url" text,
  ADD COLUMN IF NOT EXISTS "converted_from_lead_id" uuid;

ALTER TABLE "activities"
  ADD COLUMN IF NOT EXISTS "lead_id" uuid;

CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "first_name" varchar(255),
  "last_name" varchar(255),
  "title" varchar(255),
  "company" varchar(255) NOT NULL,
  "email" varchar(255),
  "phone" varchar(30),
  "linkedin_url" text,
  "avatar_url" text,
  "source" "lead_source" NOT NULL DEFAULT 'manual',
  "relationship_status" "relationship_status" NOT NULL DEFAULT 'new',
  "pipeline_stage" varchar(80) NOT NULL DEFAULT 'prospect',
  "owner_id" uuid REFERENCES "users"("id"),
  "score" smallint NOT NULL DEFAULT 0,
  "tags" text[] NOT NULL DEFAULT '{}',
  "enrichment" jsonb NOT NULL DEFAULT '{}',
  "notes" text,
  "converted_contact_id" uuid REFERENCES "contacts"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "leads_account_id_idx" ON "leads" ("account_id");
CREATE INDEX IF NOT EXISTS "leads_owner_id_idx" ON "leads" ("owner_id", "account_id");
CREATE INDEX IF NOT EXISTS "leads_relationship_status_idx" ON "leads" ("relationship_status", "account_id");
CREATE INDEX IF NOT EXISTS "leads_source_idx" ON "leads" ("source", "account_id");

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_converted_from_lead_id_fkey"
  FOREIGN KEY ("converted_from_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "activities_lead_id_idx" ON "activities" ("lead_id", "account_id");

CREATE TABLE IF NOT EXISTS "lead_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "disc" varchar(1),
  "awareness_level" smallint,
  "top_triggers" jsonb NOT NULL DEFAULT '[]',
  "primary_fear" text,
  "ego_identity" text,
  "opening_hook" text,
  "do_not" text,
  "profiled_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "lead_profiles_lead_id_idx" ON "lead_profiles" ("lead_id");

CREATE TABLE IF NOT EXISTS "aspire_saved_searches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "filters" jsonb NOT NULL DEFAULT '{}',
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "aspire_search_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "saved_search_id" uuid REFERENCES "aspire_saved_searches"("id"),
  "query" jsonb NOT NULL DEFAULT '{}',
  "result_count" smallint NOT NULL DEFAULT 0,
  "run_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "linkedin_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id"),
  "linkedin_profile_url" text,
  "extension_connected" boolean NOT NULL DEFAULT false,
  "daily_limit" smallint NOT NULL DEFAULT 50,
  "daily_sent" smallint NOT NULL DEFAULT 0,
  "health_status" varchar(30) NOT NULL DEFAULT 'healthy',
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "connected_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "linkedin_accounts_account_user_idx" ON "linkedin_accounts" ("account_id", "user_id");

CREATE TABLE IF NOT EXISTS "linkedin_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "status" "linkedin_campaign_status" NOT NULL DEFAULT 'active',
  "owner_id" uuid REFERENCES "users"("id"),
  "workflow" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "linkedin_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "campaign_id" uuid NOT NULL REFERENCES "linkedin_campaigns"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "status" varchar(30) NOT NULL DEFAULT 'active',
  "current_step" smallint NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "linkedin_sequence_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "sequence_id" uuid NOT NULL REFERENCES "linkedin_sequences"("id") ON DELETE CASCADE,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "step_number" smallint NOT NULL,
  "node_type" varchar(50) NOT NULL,
  "channel" "channel" NOT NULL DEFAULT 'linkedin',
  "subject" varchar(500),
  "content" text,
  "send_at" timestamptz NOT NULL,
  "sent_at" timestamptz,
  "status" "sequence_step_status" NOT NULL DEFAULT 'pending',
  "skip_reason" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "linkedin_sequence_steps_status_idx" ON "linkedin_sequence_steps" ("status", "send_at");
