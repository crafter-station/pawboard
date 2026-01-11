/**
 * File validation utilities
 * Validates file types, sizes, and content for upload
 */

// Supported file types
export const SUPPORTED_MIME_TYPES = ["text/plain", "text/markdown"] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

// File extension to MIME type mapping
const EXTENSION_MIME_MAP: Record<string, SupportedMimeType> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
};

// Maximum file size (10MB)
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Maximum files per board
export const MAX_FILES_PER_BOARD = 20;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: SupportedMimeType;
}

/**
 * Validate a file for upload
 */
export function validateFile(file: File): ValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
    };
  }

  // Check file size minimum (no empty files)
  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  // Get mime type from extension or file type
  const mimeType = getMimeType(file);

  if (!mimeType) {
    const supportedExtensions = Object.keys(EXTENSION_MIME_MAP).join(", ");
    return {
      valid: false,
      error: `Unsupported file type. Supported types: ${supportedExtensions}`,
    };
  }

  return {
    valid: true,
    mimeType,
  };
}

/**
 * Get MIME type from file
 */
function getMimeType(file: File): SupportedMimeType | undefined {
  // First, try to get from file extension
  const extension = getFileExtension(file.name);
  if (extension && EXTENSION_MIME_MAP[extension]) {
    return EXTENSION_MIME_MAP[extension];
  }

  // Fallback to file.type
  if (SUPPORTED_MIME_TYPES.includes(file.type as SupportedMimeType)) {
    return file.type as SupportedMimeType;
  }

  return undefined;
}

/**
 * Get file extension (lowercase, with dot)
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if adding a file would exceed the board limit
 */
export function checkBoardFileLimit(currentCount: number): ValidationResult {
  if (currentCount >= MAX_FILES_PER_BOARD) {
    return {
      valid: false,
      error: `Maximum of ${MAX_FILES_PER_BOARD} files per board reached`,
    };
  }
  return { valid: true };
}

/**
 * Sanitize filename for storage
 * Removes special characters and ensures safe storage path
 */
export function sanitizeFilename(filename: string): string {
  // Get base name and extension
  const extension = getFileExtension(filename);
  const baseName = filename.slice(0, filename.length - extension.length);

  // Remove or replace unsafe characters
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9_\-\s]/g, "") // Remove special chars
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .slice(0, 100); // Limit length

  // Ensure we have a valid name
  if (!sanitized) {
    return `file_${Date.now()}${extension}`;
  }

  return `${sanitized}${extension}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
