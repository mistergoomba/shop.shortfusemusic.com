CREATE TYPE "public"."availability" AS ENUM('IN_STOCK', 'LOW_STOCK', 'SOLD_OUT');--> statement-breakpoint
CREATE TYPE "public"."offer_trigger" AS ENUM('ALWAYS', 'CONTAINS_PRODUCT', 'CONTAINS_CATEGORY', 'MINIMUM_SUBTOTAL');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'PAID', 'SHIPPED', 'CANCELED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."shipping_zone" AS ENUM('US', 'CA', 'INTL');--> statement-breakpoint
CREATE TABLE "cart_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"product_id" integer NOT NULL,
	"offer_price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"trigger_type" "offer_trigger" DEFAULT 'ALWAYS' NOT NULL,
	"trigger_product_id" integer,
	"trigger_category_id" integer,
	"minimum_subtotal_cents" integer,
	"sort_position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"sort_position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"big_cartel_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name" varchar(200) NOT NULL,
	"product_slug" varchar(200) NOT NULL,
	"size_label" varchar(40),
	"image_url" varchar(2048),
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"is_offer" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_number_seq" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"next" integer DEFAULT 1001 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(20) NOT NULL,
	"public_ref" varchar(40) NOT NULL,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"email" varchar(320) NOT NULL,
	"customer_name" varchar(200),
	"ship_name" varchar(200),
	"ship_line1" varchar(300),
	"ship_line2" varchar(300),
	"ship_city" varchar(150),
	"ship_state" varchar(150),
	"ship_postal_code" varchar(40),
	"ship_country" varchar(2),
	"shipping_zone" "shipping_zone" NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"stripe_checkout_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"stripe_refund_id" varchar(255),
	"tracking_number" varchar(120),
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"url" varchar(2048) NOT NULL,
	"alt" varchar(300),
	"width" integer,
	"height" integer,
	"sort_position" integer DEFAULT 0 NOT NULL,
	"source_url" varchar(2048)
);
--> statement-breakpoint
CREATE TABLE "product_sizes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"label" varchar(40) NOT NULL,
	"availability" "availability" DEFAULT 'IN_STOCK' NOT NULL,
	"sort_position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"sale_price_cents" integer,
	"category_id" integer,
	"availability" "availability" DEFAULT 'IN_STOCK' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_position" integer DEFAULT 0 NOT NULL,
	"big_cartel_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "related_products" (
	"product_id" integer NOT NULL,
	"related_product_id" integer NOT NULL,
	"sort_position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "related_products_product_id_related_product_id_pk" PRIMARY KEY("product_id","related_product_id")
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"store_name" varchar(120) DEFAULT 'Short Fuse' NOT NULL,
	"contact_email" varchar(320) DEFAULT 'info@shortfusemusic.com' NOT NULL,
	"shipping_us_cents" integer DEFAULT 500 NOT NULL,
	"shipping_ca_cents" integer DEFAULT 1500 NOT NULL,
	"shipping_intl_cents" integer DEFAULT 2500 NOT NULL,
	"international_shipping_enabled" boolean DEFAULT true NOT NULL,
	"free_shipping_threshold_cents" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_event_id" varchar(255) NOT NULL,
	"type" varchar(120) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "cart_offers" ADD CONSTRAINT "cart_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_offers" ADD CONSTRAINT "cart_offers_trigger_product_id_products_id_fk" FOREIGN KEY ("trigger_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_offers" ADD CONSTRAINT "cart_offers_trigger_category_id_categories_id_fk" FOREIGN KEY ("trigger_category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "related_products" ADD CONSTRAINT "related_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "related_products" ADD CONSTRAINT "related_products_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_offers_active_idx" ON "cart_offers" USING btree ("active","sort_position");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_big_cartel_id_key" ON "categories" USING btree ("big_cartel_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_public_ref_key" ON "orders" USING btree ("public_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_stripe_session_key" ON "orders" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","sort_position");--> statement-breakpoint
CREATE UNIQUE INDEX "product_sizes_product_label_key" ON "product_sizes" USING btree ("product_id","label");--> statement-breakpoint
CREATE INDEX "product_sizes_product_idx" ON "product_sizes" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_big_cartel_id_key" ON "products" USING btree ("big_cartel_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_active_sort_idx" ON "products" USING btree ("active","sort_position");--> statement-breakpoint
CREATE INDEX "related_products_product_idx" ON "related_products" USING btree ("product_id","sort_position");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_stripe_event_id_key" ON "webhook_events" USING btree ("stripe_event_id");