-- Converte TODAS as colunas de data de TIMESTAMP(3) para TIMESTAMPTZ(3).
--
-- Motivo: os valores ja eram gravados em UTC pelo Prisma, mas a coluna nao
-- carregava marcacao de fuso nenhuma. Quem lia o banco direto (Supabase Studio,
-- SQL cru, BI) via '15:00' sem saber que aquilo era UTC e nao 12:00 de Sao Paulo.
--
-- O `USING ... AT TIME ZONE 'UTC'` e obrigatorio: sem ele o Postgres interpreta
-- os timestamps existentes no fuso da SESSAO, deslocando todo o historico em 3h.
-- Com ele a conversao e puramente de tipo e nenhum instante muda.
--
-- O DROP/SET DEFAULT tambem e proposital: deixar o CURRENT_TIMESTAMP antigo ser
-- recastado carregaria adiante o default sem fuso, que e justamente o problema.
-- Nas colunas @updatedAt o DROP e no-op (o Prisma preenche no cliente); serve so
-- para limpar drift caso o banco ainda tenha um default esquecido la.
--
-- ATENCAO: ALTER TYPE reescreve a tabela sob ACCESS EXCLUSIVE lock.

-- profiles
ALTER TABLE "SED"."profiles" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."profiles" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."profiles" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."profiles" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."profiles" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- events
ALTER TABLE "SED"."events" ALTER COLUMN "event_date" DROP DEFAULT;
ALTER TABLE "SED"."events" ALTER COLUMN "event_date" TYPE TIMESTAMPTZ(3) USING "event_date" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."events" ALTER COLUMN "end_date" DROP DEFAULT;
ALTER TABLE "SED"."events" ALTER COLUMN "end_date" TYPE TIMESTAMPTZ(3) USING "end_date" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."events" ALTER COLUMN "recurrence_until" DROP DEFAULT;
ALTER TABLE "SED"."events" ALTER COLUMN "recurrence_until" TYPE TIMESTAMPTZ(3) USING "recurrence_until" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."events" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."events" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."events" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."events" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."events" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- folders
ALTER TABLE "SED"."folders" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."folders" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."folders" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."folders" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."folders" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- whatsapp_instances
ALTER TABLE "SED"."whatsapp_instances" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."whatsapp_instances" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."whatsapp_instances" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."whatsapp_instances" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."whatsapp_instances" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- profile_whatsapp_instances
ALTER TABLE "SED"."profile_whatsapp_instances" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."profile_whatsapp_instances" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."profile_whatsapp_instances" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- forms
ALTER TABLE "SED"."forms" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."forms" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."forms" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."forms" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."forms" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- event_collaborators
ALTER TABLE "SED"."event_collaborators" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."event_collaborators" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."event_collaborators" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- form_fields
ALTER TABLE "SED"."form_fields" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."form_fields" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."form_fields" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- form_responses
ALTER TABLE "SED"."form_responses" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."form_responses" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."form_responses" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."form_responses" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."form_responses" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- registrations
ALTER TABLE "SED"."registrations" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."registrations" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."registrations" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."registrations" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."registrations" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- message_templates
ALTER TABLE "SED"."message_templates" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."message_templates" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."message_templates" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."message_templates" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."message_templates" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- automation_rules
ALTER TABLE "SED"."automation_rules" ALTER COLUMN "send_at" DROP DEFAULT;
ALTER TABLE "SED"."automation_rules" ALTER COLUMN "send_at" TYPE TIMESTAMPTZ(3) USING "send_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."automation_rules" ALTER COLUMN "fired_at" DROP DEFAULT;
ALTER TABLE "SED"."automation_rules" ALTER COLUMN "fired_at" TYPE TIMESTAMPTZ(3) USING "fired_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."automation_rules" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."automation_rules" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."automation_rules" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- outbox_messages
ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "delivered_at" DROP DEFAULT;
ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "delivered_at" TYPE TIMESTAMPTZ(3) USING "delivered_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "read_at" DROP DEFAULT;
ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "read_at" TYPE TIMESTAMPTZ(3) USING "read_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "processed_at" DROP DEFAULT;
ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "processed_at" TYPE TIMESTAMPTZ(3) USING "processed_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "SED"."outbox_messages" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

-- message_logs
ALTER TABLE "SED"."message_logs" ALTER COLUMN "delivered_at" DROP DEFAULT;
ALTER TABLE "SED"."message_logs" ALTER COLUMN "delivered_at" TYPE TIMESTAMPTZ(3) USING "delivered_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."message_logs" ALTER COLUMN "read_at" DROP DEFAULT;
ALTER TABLE "SED"."message_logs" ALTER COLUMN "read_at" TYPE TIMESTAMPTZ(3) USING "read_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."message_logs" ALTER COLUMN "sent_at" DROP DEFAULT;
ALTER TABLE "SED"."message_logs" ALTER COLUMN "sent_at" TYPE TIMESTAMPTZ(3) USING "sent_at" AT TIME ZONE 'UTC';

ALTER TABLE "SED"."message_logs" ALTER COLUMN "created_at" DROP DEFAULT;
ALTER TABLE "SED"."message_logs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "SED"."message_logs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
