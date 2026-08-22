-- Papel do colaborador dentro do evento: read < invited < admin.
--   read    → só leitura (qualquer GET)
--   invited → escreve tudo; DELETE do evento apenas o desvincula
--   admin   → tudo, inclusive apagar o evento e gerenciar colaboradores
-- O dono é admin implícito (não tem linha nesta tabela).
--
-- Aditivo. O default da coluna é 'invited', mas as linhas que já existiam são
-- promovidas a 'admin': hoje colaborador tem acesso total, e rebaixar quem já
-- estava compartilhado tiraria acesso sem ninguém pedir.
--
-- A promoção mora dentro do IF de criação da coluna, então rodar de novo não
-- promove colaborador cadastrado depois desta migration.

DO $$
DECLARE
  role_column_exists boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'EventRole' AND n.nspname = 'SED'
  ) THEN
    CREATE TYPE "SED"."EventRole" AS ENUM ('admin', 'invited', 'read');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'SED'
      AND table_name = 'event_collaborators'
      AND column_name = 'role'
  ) INTO role_column_exists;

  IF NOT role_column_exists THEN
    ALTER TABLE "SED"."event_collaborators"
      ADD COLUMN "role" "SED"."EventRole" NOT NULL DEFAULT 'invited';

    UPDATE "SED"."event_collaborators" SET "role" = 'admin';
  END IF;
END $$;
