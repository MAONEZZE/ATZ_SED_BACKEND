import { FileReference } from '@domain/shared/file-reference';

const DATA_URI_RE = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/is;

export interface LegacyDataUri {
  mimetype: string;
  binary: Buffer;
  extension: string;
}

function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1)) || 'arquivo';
  } catch {
    return 'arquivo';
  }
}

async function convertOne(
  value: unknown,
  uploadDataUri: (file: LegacyDataUri) => Promise<FileReference>,
): Promise<unknown> {
  if (typeof value !== 'string') return value;
  const match = DATA_URI_RE.exec(value);
  if (match) {
    const mimetype = match[1].toLowerCase();
    const binary = Buffer.from(match[2], 'base64');
    if (!binary.length) throw new Error('Data URI vazio encontrado no backfill');
    const extension = mimetype === 'image/jpeg' ? 'jpg' : mimetype.split('/')[1];
    return uploadDataUri({ mimetype, binary, extension });
  }
  if (value.trimStart().startsWith('data:')) {
    throw new Error('Data URI legado tem tipo não suportado');
  }
  return { url: value, name: filenameFromUrl(value), mimetype: null, size: null };
}

export async function convertLegacyDocumentValue(
  value: unknown,
  uploadDataUri: (file: LegacyDataUri) => Promise<FileReference>,
): Promise<{ changed: boolean; value: unknown }> {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === 'object')) {
      return { changed: false, value };
    }
    return {
      changed: true,
      value: await Promise.all(value.map((item) => convertOne(item, uploadDataUri))),
    };
  }
  if (typeof value === 'string') {
    return { changed: true, value: [await convertOne(value, uploadDataUri)] };
  }
  return { changed: false, value };
}
