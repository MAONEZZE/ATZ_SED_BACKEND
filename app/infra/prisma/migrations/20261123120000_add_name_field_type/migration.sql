-- Tipo de campo `name`: identifica o nome do inscrito no formulário.
--
-- ATENÇÃO: nada neste arquivo pode USAR o valor novo do enum. O Postgres
-- recusa usar valor de enum criado na mesma transação, e `prisma migrate
-- deploy` roda cada migration numa transação. A conversão dos campos
-- "Nome" existentes fica na migration seguinte.

ALTER TYPE "SED"."FieldType" ADD VALUE IF NOT EXISTS 'name';
