-- Chaves de duplicata do `on_event_delay`. Separada da migration que cria o
-- valor do enum: o Postgres não deixa usar um valor recém-criado na mesma transação.
--
-- O dedupKey do outbox carrega o momento do disparo, então o mesmo template em
-- delays diferentes ("1 dia antes" e "1 hora antes") não colide. A chave do
-- on_event_delay é (evento, template, direção, valor, unidade).

DROP INDEX IF EXISTS "SED"."automation_rules_event_trigger_template_key";

CREATE UNIQUE INDEX IF NOT EXISTS "automation_rules_event_trigger_template_key"
  ON "SED"."automation_rules" ("event_id", "trigger", "template_id")
  WHERE "active" AND "trigger" NOT IN ('on_date', 'on_event_delay');

CREATE UNIQUE INDEX IF NOT EXISTS "automation_rules_event_template_delay_key"
  ON "SED"."automation_rules" ("event_id", "template_id", "delay_direction", "delay_value", "delay_unit")
  WHERE "active" AND "trigger" = 'on_event_delay';
