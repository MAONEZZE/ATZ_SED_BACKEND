-- Conceito de campos fixos removido: organizador monta o formulário do zero.
-- Apaga os 4 campos fixos (Nome/Telefone/E-mail/Endereço) criados automaticamente
-- em eventos existentes. A coluna is_fixed permanece (sempre false daqui em diante).
DELETE FROM "ATZ_SED"."form_fields" WHERE "is_fixed" = true;
