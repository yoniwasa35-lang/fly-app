-- CreateTable
CREATE TABLE "TripDocument" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'missing',
    "note" TEXT,
    "receivedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripDocument_tripId_idx" ON "TripDocument"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripDocument_tripId_kind_key" ON "TripDocument"("tripId", "kind");

-- AddForeignKey
ALTER TABLE "TripDocument" ADD CONSTRAINT "TripDocument_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
