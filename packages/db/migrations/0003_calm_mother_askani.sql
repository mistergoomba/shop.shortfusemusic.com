ALTER TABLE "orders" ADD COLUMN "merchant_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "order_notification_emails" text;