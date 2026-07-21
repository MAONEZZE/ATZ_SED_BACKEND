-- Corrects 20260721113000_add_image_authorization: the image-authorization
-- requirement is a per-registration-form setting, not a global per-owner
-- preference. Moves it from Profile to Form (kind = registration).

-- AlterTable
ALTER TABLE "ATZ_SED"."profiles"
  DROP COLUMN "require_image_authorization";

-- AlterTable
ALTER TABLE "ATZ_SED"."forms"
  ADD COLUMN "require_image_authorization" BOOLEAN NOT NULL DEFAULT false;
