-- AddEnumValue: AutomationTrigger += recurring
ALTER TYPE "ATZ_SED"."AutomationTrigger" ADD VALUE IF NOT EXISTS 'recurring';

-- AddColumn: automation_rules.cron, automation_rules.timezone (cron+tz schedule for recurring triggers)
ALTER TABLE "ATZ_SED"."automation_rules" ADD COLUMN IF NOT EXISTS "cron" TEXT;
ALTER TABLE "ATZ_SED"."automation_rules" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
