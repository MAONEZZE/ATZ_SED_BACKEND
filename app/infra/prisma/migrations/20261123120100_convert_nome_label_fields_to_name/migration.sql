-- Converte para o tipo `name` o campo de texto com label exatamente
-- "Nome"/"Name" (sem diferenciar maiúsculas, ignorando espaços nas pontas),
-- no máximo um por formulário (o 1º por `order`, depois `created_at`), e só
-- em formulários que ainda não têm campo `name`.

UPDATE "SED"."form_fields" AS f
SET "type" = 'name'
FROM (
  SELECT DISTINCT ON (ff."form_id") ff."id"
  FROM "SED"."form_fields" AS ff
  WHERE ff."type" = 'text'
    AND lower(btrim(ff."label")) IN ('nome', 'name')
    AND NOT EXISTS (
      SELECT 1 FROM "SED"."form_fields" AS x
      WHERE x."form_id" = ff."form_id" AND x."type" = 'name'
    )
  ORDER BY ff."form_id", ff."order", ff."created_at"
) AS alvo
WHERE f."id" = alvo."id";
