ALTER TABLE "clients" ADD COLUMN "nickname" varchar(120);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "instagram" varchar(120);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "event_date" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "package_id" varchar(36);--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "deliverables" text;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;