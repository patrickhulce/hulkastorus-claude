import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string;
}

export class R2Client {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: R2Config) {
    this.bucketName = config.bucketName;

    // For testing, use local endpoint if provided
    const endpoint = config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Force path-style for testing with mock server
      forcePathStyle: !!config.endpoint,
    });
  }

  /**
   * Generate object key following ARCHITECTURE.md bucket layout:
   * <env>/<lifecycle_policy>/<user_id>/<file_id>
   */
  private generateObjectKey(params: {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
  }): string {
    return `${params.env}/${params.lifecyclePolicy}/${params.userId}/${params.fileId}`;
  }

  /**
   * Get presigned URL for uploading a file
   */
  async getUploadUrl(params: {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
    contentType?: string;
    expiresIn?: number;
  }): Promise<{uploadUrl: string; objectKey: string}> {
    const objectKey = this.generateObjectKey(params);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: params.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: params.expiresIn || 3600, // 1 hour default
    });

    return {uploadUrl, objectKey};
  }

  /**
   * Get presigned URL for downloading a file
   */
  async getDownloadUrl(params: {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
    expiresIn?: number;
  }): Promise<string> {
    const objectKey = this.generateObjectKey(params);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: params.expiresIn || 3600, // 1 hour default
    });
  }

  /**
   * Get object metadata
   */
  async getObjectInfo(params: {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
  }): Promise<{
    exists: boolean;
    size?: number;
    lastModified?: Date;
    contentType?: string;
  }> {
    const objectKey = this.generateObjectKey(params);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const response = await this.s3Client.send(command);

      return {
        exists: true,
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "NotFound") {
        return {exists: false};
      }
      throw error;
    }
  }

  /**
   * Delete an object
   */
  async deleteObject(params: {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
  }): Promise<void> {
    const objectKey = this.generateObjectKey(params);

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    await this.s3Client.send(command);
  }

  /**
   * Parse object key back to components
   */
  parseObjectKey(objectKey: string): {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
  } | null {
    const parts = objectKey.split("/");
    if (parts.length !== 4) {
      return null;
    }

    return {
      env: parts[0],
      lifecyclePolicy: parts[1],
      userId: parts[2],
      fileId: parts[3],
    };
  }

  /**
   * Upload object directly (for testing)
   */
  async putObject(params: {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
    body: string | Buffer;
    contentType?: string;
  }): Promise<void> {
    const objectKey = this.generateObjectKey(params);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      Body: params.body,
      ContentType: params.contentType || "application/octet-stream",
    });

    await this.s3Client.send(command);
  }

  /**
   * Get object content directly (for testing)
   */
  async getObject(params: {
    env: string;
    lifecyclePolicy: string;
    userId: string;
    fileId: string;
  }): Promise<{body: string; contentType?: string}> {
    const objectKey = this.generateObjectKey(params);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    const response = await this.s3Client.send(command);
    const body = (await response.Body?.transformToString()) || "";

    return {
      body,
      contentType: response.ContentType,
    };
  }
}

// Create default R2 client instance
export function createR2Client(): R2Client {
  const config: R2Config = {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: process.env.R2_BUCKET_NAME!,
    endpoint: process.env.R2_ENDPOINT, // Optional, for testing with mock server
  };

  return new R2Client(config);
}
