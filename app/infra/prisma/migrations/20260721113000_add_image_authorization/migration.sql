-- Owner-level flag requiring image-use consent on the public registration
-- form, and the per-registration proof of that consent.

-- AlterTable
ALTER TABLE "ATZ_SED"."profiles"
  ADD COLUMN "require_image_authorization" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ATZ_SED"."registrations"
  ADD COLUMN "image_authorization" BOOLEAN NOT NULL DEFAULT false;
