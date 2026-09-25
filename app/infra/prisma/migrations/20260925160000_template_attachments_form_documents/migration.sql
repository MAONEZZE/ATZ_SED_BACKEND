ALTER TYPE "SED"."FieldType" RENAME VALUE 'image' TO 'document';

ALTER TABLE "SED"."message_templates"
ADD COLUMN "attachment" JSONB;

-- Mensagens já enfileiradas precisam sobreviver à exclusão do template.
ALTER TABLE "SED"."outbox_messages"
DROP CONSTRAINT "outbox_messages_template_id_fkey";
ALTER TABLE "SED"."outbox_messages"
ADD CONSTRAINT "outbox_messages_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "SED"."message_templates"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- URLs legadas são normalizadas imediatamente. Data URIs ficam para o script
-- `npm run db:backfill-form-documents`, que precisa enviar o binário ao storage.
UPDATE "SED"."form_responses" AS response
SET "answers" = (
  SELECT jsonb_object_agg(
    entry.key,
    CASE
      WHEN field."type" = 'document'
        AND jsonb_typeof(entry.value) = 'string'
        AND entry.value #>> '{}' NOT LIKE 'data:%'
      THEN jsonb_build_array(jsonb_build_object(
        'url', entry.value #>> '{}',
        'name', regexp_replace(split_part(entry.value #>> '{}', '?', 1), '^.*/', ''),
        'mimetype', NULL,
        'size', NULL
      ))
      ELSE entry.value
    END
  ) AS answers
  FROM jsonb_each(response."answers") AS entry
  LEFT JOIN "SED"."form_fields" AS field
    ON field."id"::text = entry.key
   AND field."form_id" = response."form_id"
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_each(response."answers") AS entry
  JOIN "SED"."form_fields" AS field
    ON field."id"::text = entry.key
   AND field."form_id" = response."form_id"
  WHERE field."type" = 'document'
    AND jsonb_typeof(entry.value) = 'string'
    AND entry.value #>> '{}' NOT LIKE 'data:%'
);

UPDATE "SED"."registrations" AS registration
SET "answers" = (
  SELECT jsonb_object_agg(
    entry.key,
    CASE
      WHEN field."type" = 'document'
        AND jsonb_typeof(entry.value) = 'string'
        AND entry.value #>> '{}' NOT LIKE 'data:%'
      THEN jsonb_build_array(jsonb_build_object(
        'url', entry.value #>> '{}',
        'name', regexp_replace(split_part(entry.value #>> '{}', '?', 1), '^.*/', ''),
        'mimetype', NULL,
        'size', NULL
      ))
      ELSE entry.value
    END
  ) AS answers
  FROM jsonb_each(registration."answers") AS entry
  LEFT JOIN "SED"."form_fields" AS field
    ON field."id"::text = entry.key
   AND field."form_id" = registration."origin_form_id"
)
WHERE registration."origin_form_id" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(registration."answers") AS entry
    JOIN "SED"."form_fields" AS field
      ON field."id"::text = entry.key
     AND field."form_id" = registration."origin_form_id"
    WHERE field."type" = 'document'
      AND jsonb_typeof(entry.value) = 'string'
      AND entry.value #>> '{}' NOT LIKE 'data:%'
  );
