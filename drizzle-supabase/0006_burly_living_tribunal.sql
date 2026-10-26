ALTER TABLE "deliveries" ADD COLUMN "photo_editor_id" varchar(36);--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "video_editor_id" varchar(36);--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "vendor_price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_photo_editor_id_crew_id_fk" FOREIGN KEY ("photo_editor_id") REFERENCES "public"."crew"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_video_editor_id_crew_id_fk" FOREIGN KEY ("video_editor_id") REFERENCES "public"."crew"("id") ON DELETE set null ON UPDATE no action;