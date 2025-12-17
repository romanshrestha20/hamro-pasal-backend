-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "publicId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "imagePublicId" TEXT;
