-- N formulários por regra de automação: automation_rules.form_id (FK única)
-- vira tabela de junção. Junção vazia = "todos os formulários" (dinâmico:
-- formulário criado depois já dispara) — mesma semântica do form_id NULL
-- atual, então as regras existentes migram sem interpretação.

CREATE TABLE IF NOT EXISTS "SED"."automation_rule_forms" (
  "rule_id" TEXT NOT NULL,
  "form_id" TEXT NOT NULL,
  CONSTRAINT "automation_rule_forms_pkey" PRIMARY KEY ("rule_id", "form_id"),
  CONSTRAINT "automation_rule_forms_rule_id_fkey" FOREIGN KEY ("rule_id")
    REFERENCES "SED"."automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "automation_rule_forms_form_id_fkey" FOREIGN KEY ("form_id")
    REFERENCES "SED"."forms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "automation_rule_forms_form_id_idx"
  ON "SED"."automation_rule_forms"("form_id");

-- Backfill das regras que hoje têm form_id. Checado em 2026-08-19: são 0: SQL
-- idempotente de qualquer forma, para não depender dessa premissa se rodar
-- mais tarde (ex: reaplicação manual).
INSERT INTO "SED"."automation_rule_forms" ("rule_id", "form_id")
SELECT "id", "form_id" FROM "SED"."automation_rules" WHERE "form_id" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "SED"."automation_rules" DROP CONSTRAINT IF EXISTS "automation_rules_form_id_fkey";
DROP INDEX IF EXISTS "SED"."automation_rules_form_id_idx";
ALTER TABLE "SED"."automation_rules" DROP COLUMN IF EXISTS "form_id";

-- Trava real de duplicata: hoje NÃO existe UNIQUE nenhum em automation_rules —
-- assertNoActiveDuplicate no app é checagem de app e é racy. Só regras ativas:
-- preserva "arquivar e refazer" (regra desativada + nova com mesmo
-- template+gatilho). formId saiu da chave: com N formulários por regra, o
-- motivo de existirem duas regras com o mesmo template desaparece — o mesmo
-- template em formulários diferentes agora é UMA regra com dois formIds.
CREATE UNIQUE INDEX IF NOT EXISTS "automation_rules_event_trigger_template_key"
  ON "SED"."automation_rules" ("event_id", "trigger", "template_id")
  WHERE "active";

-- Origem da inscrição: FormResponse é N-N (form <-> registration) — depois da
-- segunda resposta não dá mais para saber qual formulário CRIOU o inscrito.
-- Coluna imutável desde a criação, evita JOIN no caminho quente da aprovação.
-- Os 352 inscritos de hoje (2026-08-19) ficam com origin_form_id NULL: nenhum
-- tem FormResponse, então não há de onde fazer backfill. Regra escopada por
-- formulário não alcança esses inscritos nem os criados direto pelo painel —
-- só uma regra "todos os formulários" cobre.
ALTER TABLE "SED"."registrations" ADD COLUMN IF NOT EXISTS "origin_form_id" TEXT;
ALTER TABLE "SED"."registrations"
  DROP CONSTRAINT IF EXISTS "registrations_origin_form_id_fkey",
  ADD CONSTRAINT "registrations_origin_form_id_fkey" FOREIGN KEY ("origin_form_id")
    REFERENCES "SED"."forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "registrations_origin_form_id_idx"
  ON "SED"."registrations"("origin_form_id");
