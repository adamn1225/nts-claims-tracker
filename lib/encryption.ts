/**
 * Encryption utilities for sensitive email credentials
 * Uses AES-256-GCM encryption with the SENDGRID_ENCRYPTION_KEY
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Get the encryption key from environment
 * Falls back to a warning if not set (for development only)
 */
function getEncryptionKey(): string {
  const key = process.env.SENDGRID_ENCRYPTION_KEY;

  if (!key) {
    console.warn(
      "⚠️  SENDGRID_ENCRYPTION_KEY not set! Email credentials will not be encrypted.",
    );
    // In production, you should throw an error here
    // For development, we'll use a fallback (DO NOT USE IN PRODUCTION)
    return "dev-only-key-change-in-production-12345678901234567890123456789012";
  }

  return key;
}

/**
 * Derive a key from the encryption key using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, "sha512");
}

/**
 * Encrypt a string value
 * Returns base64-encoded encrypted data with IV and auth tag
 */
export function encrypt(text: string): string {
  if (!text) return "";

  try {
    const masterKey = getEncryptionKey();

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine salt + iv + authTag + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, "base64"),
    ]);

    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt an encrypted string
 * Expects base64-encoded data with salt, IV, and auth tag
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return "";

  try {
    const masterKey = getEncryptionKey();

    // Decode the base64 data
    const combined = Buffer.from(encryptedData, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const encrypted = combined.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
    );

    // Derive key from master key
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(
      encrypted.toString("base64"),
      "base64",
      "utf8",
    );
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Generate a secure random encryption key
 * Use this to generate SENDGRID_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Mask a sensitive value for display
 * Shows first 4 and last 4 characters
 */
export function maskValue(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return "••••••••";
  }

  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const maskLength = Math.min(value.length - visibleChars * 2, 20);

  return `${start}${"•".repeat(maskLength)}${end}`;
}
