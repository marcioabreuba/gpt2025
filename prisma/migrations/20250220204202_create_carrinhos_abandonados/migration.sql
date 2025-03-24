-- CreateTable
CREATE TABLE "SoleTerra_CarrinhosAbandonados" (
    "id" SERIAL NOT NULL,
    "cartId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clienteEmail" TEXT,
    "clienteNome" TEXT,
    "clienteTelefone" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "valorSubtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorFrete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorDesconto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantidadeItens" INTEGER NOT NULL,
    "produtos" JSONB NOT NULL,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "tipoCarrinho" TEXT NOT NULL DEFAULT 'abandonado',
    "status" TEXT,
    "dataExpiracao" TIMESTAMP(3),
    "recuperado" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "ultimaAtividade" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoleTerra_CarrinhosAbandonados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SoleTerra_CarrinhosAbandonados_cartId_key" ON "SoleTerra_CarrinhosAbandonados"("cartId"); 