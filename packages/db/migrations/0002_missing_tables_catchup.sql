-- Catch-up migration: creates the three tables that failed to apply from
-- 0000_typical_mentallo.sql because drizzle-kit generated invalid SQL
-- ("jsonb[] DEFAULT  NOT NULL" — empty DEFAULT clause). The defaults
-- below are the same ones declared in schema.ts via sql`'{}'::…[]`.

CREATE TABLE IF NOT EXISTS "automations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "trigger_event" varchar(100) NOT NULL,
  "trigger_conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actions" jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
  "last_fired_at" timestamp with time zone,
  "fire_count" smallint DEFAULT 0 NOT NULL,
  "template_ref" varchar(80),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "record_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "stripe_invoice_id" varchar(255),
  "amount_cents" bigint NOT NULL,
  "paid_cents" bigint DEFAULT 0 NOT NULL,
  "status" "invoice_status" DEFAULT 'draft' NOT NULL,
  "due_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "line_items" jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
  "payment_link_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "integration_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "provider" varchar(60) NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "expires_at" timestamp with time zone,
  "scopes" text[] DEFAULT '{}'::text[] NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_native_mode" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign keys (wrapped to be idempotent)

DO $$ BEGIN
  ALTER TABLE "automations"
    ADD CONSTRAINT "automations_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "automation_runs"
    ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk"
    FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "messages"
    ADD CONSTRAINT "messages_automation_id_automations_id_fk"
    FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_record_id_records_id_fk"
    FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_contact_id_contacts_id_fk"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "integration_credentials"
    ADD CONSTRAINT "integration_credentials_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes

CREATE INDEX IF NOT EXISTS "automations_account_id_idx"
  ON "automations" ("account_id");
CREATE INDEX IF NOT EXISTS "automations_trigger_event_idx"
  ON "automations" ("trigger_event", "account_id");

CREATE INDEX IF NOT EXISTS "invoices_account_id_idx"
  ON "invoices" ("account_id");
CREATE INDEX IF NOT EXISTS "invoices_status_account_idx"
  ON "invoices" ("status", "account_id");
CREATE INDEX IF NOT EXISTS "invoices_contact_id_idx"
  ON "invoices" ("contact_id", "account_id");

CREATE UNIQUE INDEX IF NOT EXISTS "integration_credentials_account_provider_idx"
  ON "integration_credentials" ("account_id", "provider");
