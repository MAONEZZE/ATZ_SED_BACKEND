-- A trava de duplicata era (event_id, trigger, template_id) WHERE active, criada
-- em 2026-08-19 porque o dedupKey do outbox é registrationId:templateId:trigger.
-- Com o gatilho `on_date` (2026-08-20) isso passou a barrar um caso legítimo:
-- o mesmo template em DUAS datas ("manda no 12/02 e no 20/03"). Ali não há
-- colisão possível — o dedupKey do on_date carrega o sendAt.
-- Pior: uma regra que JÁ disparou continuava ocupando a chave, então a próxima
-- data com o mesmo template só era aceita depois de desativar a antiga.
-- Solução: a chave do on_date é (event_id, template_id, send_at); a dos outros
-- gatilhos continua como era.

DROP INDEX IF EXISTS "SED"."automation_rules_event_trigger_template_key";

CREATE UNIQUE INDEX IF NOT EXISTS "automation_rules_event_trigger_template_key"
  ON "SED"."automation_rules" ("event_id", "trigger", "template_id")
  WHERE "active" AND "trigger" <> 'on_date';

-- send_at é NOT NULL na prática para on_date (o service exige), então a chave é
-- sempre completa. Duas regras ativas com o mesmo template e a mesma data
-- continuam sendo a mesma mensagem duas vezes: 409 correto.
CREATE UNIQUE INDEX IF NOT EXISTS "automation_rules_event_template_send_at_key"
  ON "SED"."automation_rules" ("event_id", "template_id", "send_at")
  WHERE "active" AND "trigger" = 'on_date';
