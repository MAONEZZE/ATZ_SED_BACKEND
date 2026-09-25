export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface UploadResult {
  url: string;
  path: string;
}

export interface StorageObject {
  path: string;
  updatedAt: Date;
}

export interface StoragePort {
  upload(bucket: string, path: string, file: Buffer, mimeType: string): Promise<UploadResult>;
  delete(bucket: string, path: string): Promise<void>;
  move(bucket: string, fromPath: string, toPath: string): Promise<void>;
  /** Lista recursivamente os objetos sob o prefixo. */
  list(bucket: string, prefix: string): Promise<StorageObject[]>;
  getPublicUrl(bucket: string, path: string): string;
}
