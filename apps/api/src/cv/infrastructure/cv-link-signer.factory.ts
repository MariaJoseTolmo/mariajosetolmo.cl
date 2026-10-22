import { S3Client } from '@aws-sdk/client-s3';
import { ConfigError, type AppConfig } from '../../config/app-config';
import type { CvLinkSigner } from '../application/ports/cv-link-signer.port';
import { createAwsPresign } from './aws-presign';
import { FakeCvLinkSigner } from './fake-cv-link.signer';
import { S3CvLinkSigner } from './s3-cv-link.signer';

/** `loadConfig` already guarantees the s3 fields; this keeps the types honest. */
export function createCvLinkSigner(config: AppConfig): CvLinkSigner {
  const { cv } = config;
  if (cv.signer === 'fake') return new FakeCvLinkSigner(cv.ttlSeconds);
  if (!cv.bucket) throw new ConfigError('CV_BUCKET', 'is required');
  if (!cv.objectKey) throw new ConfigError('CV_OBJECT_KEY', 'is required');
  // Credentials come from the default provider chain (the runtime role).
  const client = new S3Client(
    config.awsRegion ? { region: config.awsRegion } : {},
  );
  return new S3CvLinkSigner(
    { bucket: cv.bucket, key: cv.objectKey, ttlSeconds: cv.ttlSeconds },
    createAwsPresign(client),
  );
}
