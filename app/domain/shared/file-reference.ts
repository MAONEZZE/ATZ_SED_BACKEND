export interface FileReference {
  url: string;
  name: string;
  mimetype: string;
  size: number | null;
}

export interface StoredAttachment {
  path: string;
  name: string;
  mimetype: string;
  size: number;
}
