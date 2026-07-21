-- Postgres não permite DROP VALUE em enum: recria o tipo sem before_event/after_event/after_approval.
-- Pré-condição: nenhuma linha em automation_rules.trigger pode usar esses 3 valores (checado/limpo manualmente antes desta migration).
ALTER TYPE "ATZ_SED"."AutomationTrigger" RENAME TO "AutomationTrigger_old";

CREATE TYPE "ATZ_SED"."AutomationTrigger" AS ENUM ('on_registration', 'on_post_event', 'on_nps', 'on_approval', 'on_rejection', 'recurring');

ALTER TABLE "ATZ_SED"."automation_rules"
  ALTER COLUMN "trigger" TYPE "ATZ_SED"."AutomationTrigger"
  USING ("trigger"::text::"ATZ_SED"."AutomationTrigger");

DROP TYPE "ATZ_SED"."AutomationTrigger_old";
