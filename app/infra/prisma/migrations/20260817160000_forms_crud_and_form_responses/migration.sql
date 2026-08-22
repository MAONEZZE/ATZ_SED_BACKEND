-- Formulários deixam de ser 3 tipos fixos (registration/post_event/nps) e passam a
-- ser N por evento, com nome e slug próprios. As respostas saem de
-- post_event_responses e passam a viver em form_responses (junção N formulários ×
-- N pessoas).
--
-- Nada é apagado: a coluna `forms.kind`, a tabela `post_event_responses` (vazia) e
-- a `user_subscriptions` (122 linhas, todas contendo apenas registration_answers —
-- duplicação de registrations.answers) permanecem no banco como rede de
-- segurança, apenas fora do schema.prisma. O tipo `FormFieldKind` fica órfão.

-- 1) Form ganha nome/slug/ordem; o kind existente vira nome e slug legíveis.
ALTER TABLE "SED"."forms"
  ADD COLUMN IF NOT EXISTS "name"  TEXT,
  ADD COLUMN IF NOT EXISTS "slug"  TEXT,
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

UPDATE "SED"."forms" SET
  "name" = COALESCE("name", CASE "kind"::text
    WHEN 'registration' THEN 'Inscrição'
    WHEN 'post_event'   THEN 'Pós-evento'
    WHEN 'nps'          THEN 'NPS'
    ELSE 'Formulário' END),
  "slug" = COALESCE("slug", CASE "kind"::text
    WHEN 'registration' THEN 'inscricao'
    WHEN 'post_event'   THEN 'pos-evento'
    WHEN 'nps'          THEN 'nps'
    ELSE 'formulario' END),
  "order" = CASE "kind"::text
    WHEN 'registration' THEN 0
    WHEN 'post_event'   THEN 1
    WHEN 'nps'          THEN 2
    ELSE 3 END
WHERE "name" IS NULL OR "slug" IS NULL;

ALTER TABLE "SED"."forms" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "SED"."forms" ALTER COLUMN "slug" SET NOT NULL;

-- `kind` deixa de ser escrito pelo código: passa a aceitar NULL (o default
-- continua valendo para quem inserir sem informar).
ALTER TABLE "SED"."forms" ALTER COLUMN "kind" DROP NOT NULL;

-- A unicidade agora é por slug dentro do evento, não por kind.
ALTER TABLE "SED"."forms" DROP CONSTRAINT IF EXISTS "forms_event_id_kind_key";
CREATE UNIQUE INDEX IF NOT EXISTS "forms_event_id_slug_key" ON "SED"."forms"("event_id", "slug");

-- 2) Respostas de formulário (substitui post_event_responses).
CREATE TABLE IF NOT EXISTS "SED"."form_responses" (
  "id"              TEXT NOT NULL,
  "form_id"         TEXT NOT NULL,
  "event_id"        TEXT NOT NULL,
  "registration_id" TEXT NOT NULL,
  "answers"         JSONB NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "form_responses_form_id_registration_id_key"
  ON "SED"."form_responses"("form_id", "registration_id");
CREATE INDEX IF NOT EXISTS "form_responses_event_id_idx" ON "SED"."form_responses"("event_id");
CREATE INDEX IF NOT EXISTS "form_responses_registration_id_idx" ON "SED"."form_responses"("registration_id");

ALTER TABLE "SED"."form_responses"
  DROP CONSTRAINT IF EXISTS "form_responses_form_id_fkey",
  ADD CONSTRAINT "form_responses_form_id_fkey" FOREIGN KEY ("form_id")
    REFERENCES "SED"."forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SED"."form_responses"
  DROP CONSTRAINT IF EXISTS "form_responses_event_id_fkey",
  ADD CONSTRAINT "form_responses_event_id_fkey" FOREIGN KEY ("event_id")
    REFERENCES "SED"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SED"."form_responses"
  DROP CONSTRAINT IF EXISTS "form_responses_registration_id_fkey",
  ADD CONSTRAINT "form_responses_registration_id_fkey" FOREIGN KEY ("registration_id")
    REFERENCES "SED"."registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill do pós-evento. Hoje são 0 linhas; o INSERT fica para o caso de a
-- migration rodar em outro ambiente que tenha dados.
INSERT INTO "SED"."form_responses" ("id", "form_id", "event_id", "registration_id", "answers", "created_at", "updated_at")
SELECT per."id", f."id", per."event_id", per."registration_id", per."answers", per."created_at", per."updated_at"
  FROM "SED"."post_event_responses" per
  JOIN "SED"."forms" f ON f."event_id" = per."event_id" AND f."slug" = 'pos-evento'
 ON CONFLICT DO NOTHING;

-- 3) Automação por formulário: gatilho novo + vínculo opcional com o form.
ALTER TYPE "SED"."AutomationTrigger" ADD VALUE IF NOT EXISTS 'on_form_submitted';

ALTER TABLE "SED"."automation_rules" ADD COLUMN IF NOT EXISTS "form_id" TEXT;
CREATE INDEX IF NOT EXISTS "automation_rules_form_id_idx" ON "SED"."automation_rules"("form_id");
ALTER TABLE "SED"."automation_rules"
  DROP CONSTRAINT IF EXISTS "automation_rules_form_id_fkey",
  ADD CONSTRAINT "automation_rules_form_id_fkey" FOREIGN KEY ("form_id")
    REFERENCES "SED"."forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Telefone único por evento — só para inscrições novas.
-- Os 20 grupos de telefone duplicado que existem hoje (49 inscritos, 8 deles com
-- nomes diferentes = telefone compartilhado) NÃO são tocados: o índice é parcial
-- por data, então protege daqui pra frente sem apagar ninguém.
CREATE UNIQUE INDEX IF NOT EXISTS "registrations_event_phone_new_key"
  ON "SED"."registrations" ("event_id", (regexp_replace("phone", '[^0-9]', '', 'g')))
  WHERE "created_at" >= '2026-08-17';
