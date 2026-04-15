/**
 * Storage abstraction for creative asset uploads.
 *
 * The worker generates images and videos via AI providers and needs to
 * persist them to durable object storage (S3 / GCS / R2) before handing
 * URLs back to campaigns. This module defines the interface and a default
 * no-op implementation; production wiring calls {@link setStorageClient}
 * during boot with a concrete adapter.
 */

export interface UploadResult {
  url: string;
}

export interface StorageClient {
  uploadImage(buffer: Buffer | string, key: string): Promise<UploadResult>;
  uploadVideo(buffer: Buffer | string, key: string): Promise<UploadResult>;
}

export class NoopStorageClient implements StorageClient {
  async uploadImage(_buffer: Buffer | string, _key: string): Promise<UploadResult> {
    throw new Error('Storage not configured. Set STORAGE_PROVIDER env var.');
  }

  async uploadVideo(_buffer: Buffer | string, _key: string): Promise<UploadResult> {
    throw new Error('Storage not configured. Set STORAGE_PROVIDER env var.');
  }
}

let storageClient: StorageClient = new NoopStorageClient();

export function getStorageClient(): StorageClient {
  return storageClient;
}

export function setStorageClient(client: StorageClient): void {
  storageClient = client;
}

/**
 * Returns true when the currently registered client is the default no-op
 * implementation. Callers can use this to skip upload attempts and fall
 * back to the raw provider URL until a real storage adapter is wired.
 */
export function isStorageConfigured(): boolean {
  return !(storageClient instanceof NoopStorageClient);
}
