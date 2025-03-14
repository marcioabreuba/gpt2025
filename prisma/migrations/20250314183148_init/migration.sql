/*
  Warnings:

  - You are about to drop the `Orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QueueTraining` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Orders";

-- DropTable
DROP TABLE "QueueTraining";

-- CreateTable
CREATE TABLE "SoleTerra_Orders" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoleTerra_Orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoleTerra_QueueTraining" (
    "id" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "productId" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoleTerra_QueueTraining_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoleTerra_Orders_orderId_key" ON "SoleTerra_Orders"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SoleTerra_Orders_externalId_key" ON "SoleTerra_Orders"("externalId");
