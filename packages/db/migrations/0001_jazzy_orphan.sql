ALTER TABLE "orders" ADD COLUMN "confirmation_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_email_sent_at" timestamp with time zone;