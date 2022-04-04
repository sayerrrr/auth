-- CreateTable
CREATE TABLE "Metadata" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT false,
    "address" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,

    CONSTRAINT "Metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "sig" TEXT NOT NULL,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Metadata_email_key" ON "Metadata"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Metadata_publicKey_key" ON "Metadata"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "Metadata_identityId_key" ON "Metadata"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_uuid_key" ON "Identity"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_publicKey_key" ON "Signature"("publicKey");

-- AddForeignKey
ALTER TABLE "Metadata" ADD CONSTRAINT "Metadata_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
