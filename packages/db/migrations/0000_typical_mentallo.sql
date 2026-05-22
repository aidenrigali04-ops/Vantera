DO $$ BEGIN
 CREATE TYPE "actor_type" AS ENUM('user', 'system', 'automation', 'contact');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "channel" AS ENUM('sms', 'email', 'portal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "contact_type" AS ENUM('customer', 'tenant', 'owner', 'agency_client', 'buyer', 'seller', 'landlord');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "direction" AS ENUM('outbound', 'inbound');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "invoice_status" AS ENUM('draft', 'sent', 'viewed', 'paid', 'overdue', 'voided');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'read');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "plan" AS ENUM('team', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "priority" AS ENUM('urgent', 'high', 'normal', 'low');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "role" AS ENUM('owner', 'admin', 'manager', 'staff', 'technician', 'agent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "run_status" AS ENUM('pending', 'running', 'success', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "severity" AS ENUM('red', 'yellow', 'green');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "vertical" AS ENUM('agency', 'hvac', 'landscaping', 'plumbing', 'construction', 'property_mgmt', 'real_estate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(255) NOT NULL,
	"vertical" "vertical" NOT NULL,
	"plan" "plan" DEFAULT 'team' NOT NULL,
	"brand_logo_url" text,
	"brand_primary_color" varchar(7) DEFAULT '#1648A0',
	"brand_secondary_color" varchar(7) DEFAULT '#0D9488',
	"portal_domain" varchar(255),
	"timezone" varchar(60) DEFAULT 'America/Los_Angeles' NOT NULL,
	"stripe_customer_id" varchar(255),
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"record_id" uuid,
	"contact_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid NOT NULL,
	"activity_type" varchar(80) NOT NULL,
	"body" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visible_to_client" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"trigger_event" varchar(100) NOT NULL,
	"trigger_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_type" varchar(80) NOT NULL,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger_event" varchar(100) NOT NULL,
	"trigger_conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actions" jsonb[] DEFAULT  NOT NULL,
	"last_fired_at" timestamp with time zone,
	"fire_count" smallint DEFAULT 0 NOT NULL,
	"template_ref" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "contact_type" DEFAULT 'customer' NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(30),
	"address_line1" text,
	"address_line2" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip" varchar(20),
	"portal_access" boolean DEFAULT false NOT NULL,
	"portal_last_login_at" timestamp with time zone,
	"ltv_cents" bigint DEFAULT 0 NOT NULL,
	"churn_risk_score" smallint DEFAULT 0 NOT NULL,
	"upsell_score" smallint DEFAULT 0 NOT NULL,
	"tags" text[] DEFAULT  NOT NULL,
	"source" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"record_id" uuid,
	"contact_id" uuid,
	"doc_type" varchar(80) NOT NULL,
	"title" varchar(255) NOT NULL,
	"storage_url" text NOT NULL,
	"requires_signature" boolean DEFAULT false NOT NULL,
	"signed_at" timestamp with time zone,
	"signer_contact_id" uuid,
	"visible_to_client" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"flag_name" varchar(80) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" varchar(60) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scopes" text[] DEFAULT  NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_native_mode" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intelligence_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"record_id" uuid,
	"contact_id" uuid,
	"signal_type" varchar(80) NOT NULL,
	"severity" "severity" NOT NULL,
	"headline" varchar(255) NOT NULL,
	"recommendation" text,
	"action_label" varchar(80),
	"action_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_score" smallint DEFAULT 0 NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
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
	"line_items" jsonb[] DEFAULT  NOT NULL,
	"payment_link_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"record_id" uuid,
	"contact_id" uuid NOT NULL,
	"direction" "direction" NOT NULL,
	"channel" "channel" NOT NULL,
	"subject" varchar(500),
	"body" text NOT NULL,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"automation_id" uuid,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"record_type" varchar(60) NOT NULL,
	"title" varchar(255) NOT NULL,
	"stage_id" uuid NOT NULL,
	"assigned_user_id" uuid,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"value_cents" bigint DEFAULT 0 NOT NULL,
	"actual_value_cents" bigint DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_rule" text,
	"source" varchar(100),
	"close_probability" smallint DEFAULT 50 NOT NULL,
	"is_pipeline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stage_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"record_type" varchar(60) NOT NULL,
	"label" varchar(100) NOT NULL,
	"position" smallint NOT NULL,
	"color" varchar(7) DEFAULT '#64748B' NOT NULL,
	"triggers_automation" boolean DEFAULT true NOT NULL,
	"is_terminal_win" boolean DEFAULT false NOT NULL,
	"is_terminal_loss" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'staff' NOT NULL,
	"avatar_url" text,
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vertical_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vertical" "vertical" NOT NULL,
	"record_type" varchar(60) NOT NULL,
	"template_data" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_account_id_idx" ON "activities" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_record_id_idx" ON "activities" ("record_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_contact_id_idx" ON "activities" ("contact_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_created_at_idx" ON "activities" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_account_id_idx" ON "automation_runs" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_automation_id_idx" ON "automation_runs" ("automation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_status_idx" ON "automation_runs" ("status","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automations_account_id_idx" ON "automations" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automations_trigger_event_idx" ON "automations" ("trigger_event","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_account_id_idx" ON "contacts" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_email_account_idx" ON "contacts" ("email","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_account_id_idx" ON "documents" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_record_id_idx" ON "documents" ("record_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_account_flag_idx" ON "feature_flags" ("account_id","flag_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_credentials_account_provider_idx" ON "integration_credentials" ("account_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signals_account_id_idx" ON "intelligence_signals" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "signals_severity_account_idx" ON "intelligence_signals" ("severity","account_id","is_dismissed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_account_id_idx" ON "invoices" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_account_idx" ON "invoices" ("status","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_contact_id_idx" ON "invoices" ("contact_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_account_id_idx" ON "messages" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_contact_id_idx" ON "messages" ("contact_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_record_id_idx" ON "messages" ("record_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_status_idx" ON "messages" ("status","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_account_id_idx" ON "records" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_contact_id_idx" ON "records" ("contact_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_stage_id_idx" ON "records" ("stage_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_assigned_user_id_idx" ON "records" ("assigned_user_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_scheduled_at_idx" ON "records" ("scheduled_at","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stage_definitions_account_id_idx" ON "stage_definitions" ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stage_definitions_account_record_type_idx" ON "stage_definitions" ("account_id","record_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_account_id_idx" ON "users" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_account_idx" ON "users" ("email","account_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automations" ADD CONSTRAINT "automations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_signer_contact_id_contacts_id_fk" FOREIGN KEY ("signer_contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intelligence_signals" ADD CONSTRAINT "intelligence_signals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intelligence_signals" ADD CONSTRAINT "intelligence_signals_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intelligence_signals" ADD CONSTRAINT "intelligence_signals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intelligence_signals" ADD CONSTRAINT "intelligence_signals_dismissed_by_user_id_users_id_fk" FOREIGN KEY ("dismissed_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_stage_id_stage_definitions_id_fk" FOREIGN KEY ("stage_id") REFERENCES "stage_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stage_definitions" ADD CONSTRAINT "stage_definitions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
