-- AlterTable
ALTER TABLE "Reward" ADD COLUMN "descriptionEn" TEXT,
ADD COLUMN "nameEn" TEXT;

-- English copy for the reward that already exists
UPDATE "Reward" SET "nameEn" = 'PaoPao LINE stickers', "descriptionEn" = 'A PaoPao LINE sticker set'
  WHERE "id" = 'eeb30ff3-de42-4b16-8609-5901b477a428' AND "nameEn" IS NULL;
