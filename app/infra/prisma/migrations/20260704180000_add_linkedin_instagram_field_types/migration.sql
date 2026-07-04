-- AddEnumValue: FieldType += linkedin, instagram
ALTER TYPE "ATZ_SED"."FieldType" ADD VALUE IF NOT EXISTS 'linkedin';
ALTER TYPE "ATZ_SED"."FieldType" ADD VALUE IF NOT EXISTS 'instagram';
