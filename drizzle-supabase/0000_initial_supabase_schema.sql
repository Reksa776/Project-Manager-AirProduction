CREATE TABLE "admins" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(190) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'ADMIN' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "chk_admins_role" CHECK (role in ('OWNER', 'ADMIN', 'STAFF'))
);
--> statement-breakpoint
CREATE TABLE "cashflows" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"job_id" varchar(36),
	"occurred_on" date NOT NULL,
	"direction" varchar(10) NOT NULL,
	"category" varchar(24) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" varchar(190) NOT NULL,
	"reference_type" varchar(24),
	"reference_id" varchar(36),
	"source" varchar(16) DEFAULT 'MANUAL' NOT NULL,
	"idempotency_key" varchar(190),
	"idempotency_fingerprint" char(64),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "chk_cashflows_amount_positive" CHECK (amount > 0),
	CONSTRAINT "chk_cashflows_direction" CHECK (direction in ('INCOME', 'EXPENSE')),
	CONSTRAINT "chk_cashflows_category" CHECK (category in ('CLIENT_PAYMENT', 'CREW_PAYMENT', 'VENDOR_PAYMENT', 'TRANSPORT', 'EQUIPMENT', 'OTHER')),
	CONSTRAINT "chk_cashflows_direction_category" CHECK ((direction = 'INCOME' and category = 'CLIENT_PAYMENT')
          or (direction = 'EXPENSE' and category in ('CREW_PAYMENT', 'VENDOR_PAYMENT', 'TRANSPORT', 'EQUIPMENT', 'OTHER'))),
	CONSTRAINT "chk_cashflows_reference" CHECK ((reference_type is null and reference_id is null)
          or (reference_type is not null
              and reference_id is not null
              and reference_type in ('client_payment', 'vendor_payment', 'job_crew'))),
	CONSTRAINT "chk_cashflows_source" CHECK (source in ('MANUAL', 'MIGRATION'))
);
--> statement-breakpoint
CREATE TABLE "client_payments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"term" varchar(20) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"due_date" date,
	"paid_date" date,
	"notes" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "chk_client_payments_amount_positive" CHECK (amount > 0),
	CONSTRAINT "chk_client_payments_term" CHECK (term in ('TERMIN_1', 'TERMIN_2', 'TERMIN_3'))
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"company_name" varchar(120),
	"contact_person" varchar(120),
	"phone" varchar(120),
	"email" varchar(190),
	"address" text,
	"client_type" varchar(32),
	"notes" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"crew_role_id" varchar(36) NOT NULL,
	"default_payment" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"phone" varchar(120),
	"notes" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_roles" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(60) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"name" varchar(160) NOT NULL,
	"delivery_type" varchar(40),
	"quantity" integer,
	"deadline" date NOT NULL,
	"status" varchar(20) NOT NULL,
	"delivered_at" date,
	"notes" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "chk_deliveries_quantity" CHECK (quantity is null or quantity >= 0),
	CONSTRAINT "chk_deliveries_status" CHECK (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'))
);
--> statement-breakpoint
CREATE TABLE "job_crews" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"crew_id" varchar(36) NOT NULL,
	"crew_role_id" varchar(36),
	"agreed_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "chk_job_crews_agreed_amount" CHECK (agreed_amount >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_sequences" (
	"year" smallint NOT NULL,
	"next_seq" integer NOT NULL,
	CONSTRAINT "job_sequences_year" PRIMARY KEY("year")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"job_number" varchar(32) NOT NULL,
	"job_name" varchar(160) NOT NULL,
	"category" varchar(20) NOT NULL,
	"client_id" varchar(36),
	"package_id" varchar(36),
	"vendor_id" varchar(36),
	"execution_date" date NOT NULL,
	"status" varchar(20) NOT NULL,
	"location" varchar(190),
	"notes" text,
	"legacy_venue_name" varchar(190),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "chk_jobs_client_vendor_xor" CHECK ((client_id is null) <> (vendor_id is null)),
	CONSTRAINT "chk_jobs_category" CHECK (category in ('WEDDING', 'PREWEDDING', 'CORPORATE', 'EVENT', 'OTHER')),
	CONSTRAINT "chk_jobs_status" CHECK (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'))
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"admin_id" varchar(36) NOT NULL,
	"token_hash" char(64) NOT NULL,
	"expires_at" timestamp(3) NOT NULL,
	"last_seen_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_payments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"job_id" varchar(36) NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"due_date" date,
	"paid_date" date,
	"notes" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "chk_vendor_payments_amount_positive" CHECK (amount > 0),
	CONSTRAINT "chk_vendor_payments_type" CHECK (type in ('DP', 'PELUNASAN'))
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"contact_person" varchar(120),
	"phone" varchar(120),
	"email" varchar(190),
	"notes" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cashflows" ADD CONSTRAINT "cashflows_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew" ADD CONSTRAINT "crew_crew_role_id_crew_roles_id_fk" FOREIGN KEY ("crew_role_id") REFERENCES "public"."crew_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_crews" ADD CONSTRAINT "job_crews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_crews" ADD CONSTRAINT "job_crews_crew_id_crew_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crew"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_crews" ADD CONSTRAINT "job_crews_crew_role_id_crew_roles_id_fk" FOREIGN KEY ("crew_role_id") REFERENCES "public"."crew_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_admins_email" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_cashflows_occurred_on" ON "cashflows" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "idx_cashflows_direction_category" ON "cashflows" USING btree ("direction","category");--> statement-breakpoint
CREATE INDEX "idx_cashflows_reference" ON "cashflows" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cashflows_idempotency_key" ON "cashflows" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_crew_roles_name" ON "crew_roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_job_number" ON "jobs" USING btree ("job_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_packages_name" ON "packages" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sessions_token_hash" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.airprod_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admins', 'cashflows', 'client_payments', 'clients', 'crew', 'crew_roles',
    'deliveries', 'job_crews', 'jobs', 'packages', 'sessions',
    'vendor_payments', 'vendors'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.airprod_set_updated_at()',
      'trg_' || table_name || '_updated_at', table_name
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END;
$$;
