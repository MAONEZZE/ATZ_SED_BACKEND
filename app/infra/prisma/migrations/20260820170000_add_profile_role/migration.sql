-- Adiciona role de plataforma ao profile (team|user). Signup do Supabase é
-- aberto, então a promoção em massa só é segura porque a tabela foi
-- auditada antes (9 profiles, todos gente do time) — ver
-- docs/plans/2026-08-20-profile-role.md. A promoção mora dentro do IF, então
-- rodar de novo não promove quem se cadastrar depois.
DO $$
DECLARE
  role_column_exists boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ProfileRole' AND n.nspname = 'SED'
  ) THEN
    CREATE TYPE "SED"."ProfileRole" AS ENUM ('team', 'user');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'SED' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO role_column_exists;

  IF NOT role_column_exists THEN
    ALTER TABLE "SED"."profiles"
      ADD COLUMN "role" "SED"."ProfileRole" NOT NULL DEFAULT 'user';

    UPDATE "SED"."profiles" SET "role" = 'team';
  END IF;
END $$;
