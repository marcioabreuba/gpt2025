-- CreateTable
CREATE TABLE "Orders" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusDescription" TEXT,
    "origin" TEXT NOT NULL,
    "externalId" TEXT,
    "value" TEXT NOT NULL,
    "discount" TEXT,
    "currency" TEXT,
    "linkStatus" TEXT,
    "formPayment" TEXT,
    "formSend" TEXT,
    "datePurchase" TEXT,
    "forecast" INTEGER DEFAULT 0,
    "coupon" JSONB,
    "Address" JSONB,
    "items" JSONB NOT NULL,
    "recovery" JSONB,
    "tracking" JSONB,
    "shopifyId" JSONB,
    "yampiId" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Orders_orderId_key" ON "Orders"("orderId");
