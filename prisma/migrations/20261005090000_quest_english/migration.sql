-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "titleEn" TEXT;


-- English copy for the quests that already exist
UPDATE "Quest" SET "titleEn" = 'Log a transaction with PaoPao', "descriptionEn" = 'Record at least one transaction a day'
  WHERE "id" = 'ecf8670c-86b2-4900-b137-654450da4b47' AND "titleEn" IS NULL;
UPDATE "Quest" SET "titleEn" = 'First sign-in', "descriptionEn" = 'A welcome reward for new members'
  WHERE "id" = '6ed565b8-90b8-4171-bc81-8bfe13bfa62a' AND "titleEn" IS NULL;
