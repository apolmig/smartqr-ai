-- AlterTable
ALTER TABLE "public"."qr_codes" ADD COLUMN     "qrColor" TEXT NOT NULL DEFAULT '#000000',
ADD COLUMN     "qrOptions" TEXT,
ADD COLUMN     "qrSize" INTEGER NOT NULL DEFAULT 256,
ADD COLUMN     "qrStyle" TEXT NOT NULL DEFAULT 'classic';
