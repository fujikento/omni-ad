/**
 * File Upload REST Routes
 *
 * Simple local file upload for development. In production,
 * this would be replaced with S3 presigned URLs.
 */

import type { FastifyInstance } from 'fastify';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { verifyToken } from '@omni-ad/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = resolve(process.cwd(), 'uploads');

const ALLOWED_MIME_PREFIXES = ['image/', 'video/'] as const;

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerUploadRoutes(server: FastifyInstance): void {
  // POST /api/upload -- multipart file upload
  server.post('/api/upload', async (request, reply) => {
    // Verify authentication
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      verifyToken(authHeader.slice(7));
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Get the uploaded file
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    // Validate mime type
    const isAllowedMime = ALLOWED_MIME_PREFIXES.some((prefix) =>
      file.mimetype.startsWith(prefix),
    );

    if (!isAllowedMime) {
      return reply.status(400).send({
        error: 'Invalid file type. Only image/* and video/* are allowed.',
        receivedMimeType: file.mimetype,
      });
    }

    // Read file buffer and validate size
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of file.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_FILE_SIZE) {
        return reply.status(413).send({
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      }
      chunks.push(chunk);
    }

    // Check if the stream was truncated (file.file.truncated is set by @fastify/multipart)
    if (file.file.truncated) {
      return reply.status(413).send({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    const buffer = Buffer.concat(chunks);

    // Generate unique filename preserving extension
    const ext = extname(file.filename) || mimeToExtension(file.mimetype);
    const uniqueFilename = `${randomUUID()}${ext}`;

    // Ensure uploads directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Write file
    const filePath = resolve(UPLOAD_DIR, uniqueFilename);
    await writeFile(filePath, buffer);

    return reply.status(200).send({
      url: `/uploads/${uniqueFilename}`,
      filename: file.filename,
      size: buffer.length,
      mimeType: file.mimetype,
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mimeToExtension(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return map[mime] ?? '';
}
