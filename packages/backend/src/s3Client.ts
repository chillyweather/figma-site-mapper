import { S3Client } from "@aws-sdk/client-s3";

const { S3_ENDPOINT_URL, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY } =
  process.env;

if (!S3_ENDPOINT_URL || !S3_REGION || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
  console.warn(
    "S3 environment variables not set. File uploads will be disabled."
  );
}

export const s3Client = new S3Client({
  endpoint: `https://${S3_ENDPOINT_URL}`,
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY!,
    secretAccessKey: S3_SECRET_KEY!,
  },
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME;
export const PUBLIC_URL_BASE = `https://${BUCKET_NAME}.${S3_ENDPOINT_URL}`;
