-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "coverCredit" TEXT,
ADD COLUMN     "coverImageUrl" TEXT;

-- CreateTable
CREATE TABLE "Stay" (
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" TEXT,
    "boardBasis" TEXT,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "officialUrl" TEXT,
    "officialUrlSource" TEXT NOT NULL DEFAULT 'manual',
    "voucherUrl" TEXT,
    "placeId" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "stars" INTEGER,
    "photosJson" TEXT,
    "photosCachedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("componentId")
);

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
