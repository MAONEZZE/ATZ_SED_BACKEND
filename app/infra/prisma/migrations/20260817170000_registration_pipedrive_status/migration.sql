-- O resultado do envio ao Pipedrive por inscrito passa a viver em `registrations`.
-- Antes ficava em `user_subscriptions.pipedrive_status`, tabela que sai do código
-- nesta fatia (as 122 linhas dela só tinham registration_answers, duplicando
-- registrations.answers).
--
-- Aditivo e nullable: null = o evento não pede envio ao Pipedrive.

ALTER TABLE "SED"."registrations"
  ADD COLUMN IF NOT EXISTS "pipedrive_status" "SED"."PipedriveStatus";
