import { Prisma, PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  convertLegacyDocumentValue,
  LegacyDataUri,
} from '@application/registration_module/form-document-backfill';
import { FileReference } from '@domain/shared/file-reference';

const prisma = new PrismaClient();
const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
const folder = process.env.SUPABASE_STORAGE_BUCKET_UPLOADS!;
const storage = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
).storage.from(bucket);

async function uploadLegacyDataUri(
  file: LegacyDataUri,
  scope: { eventId: string; formId: string },
): Promise<FileReference> {
  const path = `${folder}/${scope.eventId}/${scope.formId}/${randomUUID()}.${file.extension}`;
  const { error } = await storage.upload(path, file.binary, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw new Error(`Falha no upload de ${path}: ${error.message}`);
  const { data } = storage.getPublicUrl(path);
  return {
    url: data.publicUrl,
    name: `imagem-legada.${file.extension}`,
    mimetype: file.mimetype,
    size: file.binary.length,
  };
}

async function convertAnswers(
  answers: Prisma.JsonValue,
  fieldIds: Set<string>,
  scope: { eventId: string; formId: string },
): Promise<{ changed: boolean; answers: Prisma.InputJsonObject }> {
  const source = (answers ?? {}) as Record<string, unknown>;
  const converted: Record<string, unknown> = { ...source };
  let changed = false;
  for (const fieldId of fieldIds) {
    const value = source[fieldId];
    const result = await convertLegacyDocumentValue(value, (file) =>
      uploadLegacyDataUri(file, scope),
    );
    if (result.changed) {
      converted[fieldId] = result.value;
      changed = true;
    }
  }
  return { changed, answers: converted as Prisma.InputJsonObject };
}

async function main(): Promise<void> {
  const fields = await prisma.formField.findMany({
    where: { type: 'document' },
    select: { id: true, formId: true },
  });
  const fieldIdsByForm = new Map<string, Set<string>>();
  for (const field of fields) {
    const ids = fieldIdsByForm.get(field.formId) ?? new Set<string>();
    ids.add(field.id);
    fieldIdsByForm.set(field.formId, ids);
  }
  const formIds = [...fieldIdsByForm.keys()];
  if (!formIds.length) return;

  let updated = 0;
  const responses = await prisma.formResponse.findMany({
    where: { formId: { in: formIds } },
    select: { id: true, eventId: true, formId: true, answers: true },
  });
  for (const response of responses) {
    const result = await convertAnswers(response.answers, fieldIdsByForm.get(response.formId)!, {
      eventId: response.eventId,
      formId: response.formId,
    });
    if (result.changed) {
      await prisma.formResponse.update({
        where: { id: response.id },
        data: { answers: result.answers },
      });
      updated++;
    }
  }

  const registrations = await prisma.registration.findMany({
    where: { originFormId: { in: formIds } },
    select: { id: true, eventId: true, originFormId: true, answers: true },
  });
  for (const registration of registrations) {
    const formId = registration.originFormId!;
    const result = await convertAnswers(registration.answers, fieldIdsByForm.get(formId)!, {
      eventId: registration.eventId,
      formId,
    });
    if (result.changed) {
      await prisma.registration.update({
        where: { id: registration.id },
        data: { answers: result.answers },
      });
      updated++;
    }
  }
  process.stdout.write(`Backfill concluído: ${updated} registro(s) atualizado(s).\n`);
}

void main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
