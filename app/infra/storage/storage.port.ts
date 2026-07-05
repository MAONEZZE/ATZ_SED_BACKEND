export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface UploadResult {
  url: string;
  path: string;
}

export interface StoragePort {
  upload(bucket: string, path: string, file: Buffer, mimeType: string): Promise<UploadResult>;
  delete(bucket: string, path: string): Promise<void>;
  getPublicUrl(bucket: string, path: string): string;
}
