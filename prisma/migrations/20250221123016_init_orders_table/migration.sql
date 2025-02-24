/*
  Warnings:

  - The `date_purchase` column on the `orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "billing_address" JSONB,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "checkout_date" TIMESTAMP(3),
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "confirmation_email_sent_at" TIMESTAMP(3),
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "fulfillment_date" TIMESTAMP(3),
ADD COLUMN     "fulfillment_service" TEXT,
ADD COLUMN     "fulfillment_status" TEXT,
ADD COLUMN     "processed_at" TIMESTAMP(3),
DROP COLUMN "date_purchase",
ADD COLUMN     "date_purchase" TIMESTAMP(3);
