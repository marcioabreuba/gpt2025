/*
  Warnings:

  - You are about to drop the `Orders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Orders";

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "status_description" TEXT,
    "origin" TEXT NOT NULL,
    "external_id" TEXT,
    "value" TEXT NOT NULL,
    "discount" TEXT,
    "currency" TEXT,
    "link_status" TEXT,
    "form_payment" TEXT,
    "form_send" TEXT,
    "date_purchase" TEXT,
    "forecast" INTEGER DEFAULT 0,
    "coupon" JSONB,
    "Address" JSONB,
    "items" JSONB NOT NULL,
    "recovery" JSONB,
    "tracking" JSONB,
    "shopify_id" JSONB,
    "yampi_id" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_name" TEXT,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "tracking_code" TEXT,
    "tracking_status" TEXT,
    "tracking_updated_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_id_key" ON "orders"("order_id");
