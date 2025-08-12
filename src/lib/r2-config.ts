import {R2Client} from "./r2-client";

// Environment configuration for R2
export const r2Config = {
  accountId: process.env.R2_ACCOUNT_ID || "test-account",
  accessKeyId: process.env.R2_ACCESS_KEY_ID || "test-access-key",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "test-secret-key",
  bucketName: process.env.R2_BUCKET_NAME || "hulkastorus-ugc",
  endpoint: process.env.R2_ENDPOINT, // Optional override for testing
};

// Current environment for bucket layout
export const currentEnv = process.env.NODE_ENV || "development";

// Lifecycle policies as defined in ARCHITECTURE.md
export const lifecyclePolicies = {
  INFINITE: "infinite",
  DAYS_180: "180d",
  DAYS_90: "90d",
  DAYS_30: "30d",
  DAYS_14: "14d",
  DAYS_7: "7d",
  DAYS_3: "3d",
  DAYS_2: "2d",
  DAYS_1: "1d",
} as const;

export type LifecyclePolicy = (typeof lifecyclePolicies)[keyof typeof lifecyclePolicies];

// Create singleton R2 client instance
let r2ClientInstance: R2Client | null = null;

export function getR2Client(): R2Client {
  if (!r2ClientInstance) {
    r2ClientInstance = new R2Client(r2Config);
  }
  return r2ClientInstance;
}

// For testing: reset the singleton
export function resetR2Client(): void {
  r2ClientInstance = null;
}

// Helper function to get lifecycle policy from string
export function parseLifecyclePolicy(policy: string): LifecyclePolicy {
  const validPolicies = Object.values(lifecyclePolicies);
  if (validPolicies.includes(policy as LifecyclePolicy)) {
    return policy as LifecyclePolicy;
  }
  return lifecyclePolicies.INFINITE; // Default fallback
}
