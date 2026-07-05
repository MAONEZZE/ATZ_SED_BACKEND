-- Reduce FunnelStatus to {pending, approved, rejected} and drop the
-- screening/qualification/waitlist automation triggers.

-- 1. Remap existing data off the values being removed.
UPDATE "ATZ_SED"."registrations"
  SET "status" = 'approved'
  WHERE "status" IN ('screening', 'qualification', 'waitlist');

DELETE FROM "ATZ_SED"."automation_rules"
  WHERE "trigger" IN ('on_screening', 'on_qualification', 'on_waitlist');

-- 2. Recreate FunnelStatus without the removed values.
ALTER TYPE "ATZ_SED"."FunnelStatus" RENAME TO "FunnelStatus_old";
CREATE TYPE "ATZ_SED"."FunnelStatus" AS ENUM ('pending', 'approved', 'rejected');
ALTER TABLE "ATZ_SED"."registrations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ATZ_SED"."registrations"
  ALTER COLUMN "status" TYPE "ATZ_SED"."FunnelStatus"
  USING ("status"::text::"ATZ_SED"."FunnelStatus");
ALTER TABLE "ATZ_SED"."registrations" ALTER COLUMN "status" SET DEFAULT 'pending';
DROP TYPE "ATZ_SED"."FunnelStatus_old";

-- 3. Recreate AutomationTrigger without the removed values.
ALTER TYPE "ATZ_SED"."AutomationTrigger" RENAME TO "AutomationTrigger_old";
CREATE TYPE "ATZ_SED"."AutomationTrigger" AS ENUM ('on_registration', 'on_approval', 'on_rejection', 'before_event', 'after_event', 'after_approval');
ALTER TABLE "ATZ_SED"."automation_rules"
  ALTER COLUMN "trigger" TYPE "ATZ_SED"."AutomationTrigger"
  USING ("trigger"::text::"ATZ_SED"."AutomationTrigger");
DROP TYPE "ATZ_SED"."AutomationTrigger_old";
