import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Presign } from './s3-cv-link.signer';

/** Signing is a local computation: no request is sent to AWS. */
export function createAwsPresign(client: S3Client): Presign {
  return ({ bucket, key, expiresInSeconds, signingDate }) =>
    getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: expiresInSeconds,
      signingDate,
    });
}
