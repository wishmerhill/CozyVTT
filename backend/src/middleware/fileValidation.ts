import { Response, NextFunction } from 'express';
import { fileTypeFromFile } from 'file-type';
import fs from 'fs/promises';
import path from 'path';
import { AssetType, isAllowedMimeType, deleteFile, getFileSizeLimit, ALLOWED_EXTENSIONS } from '../utils/fileUtils';
import { UploadRequest } from './upload';
import logger from '../utils/logger';
import { isPlainTextFile } from '../utils/textFile';

/**
 * Validate uploaded file by checking actual MIME type from file content (magic bytes)
 * This prevents users from uploading malicious files with fake extensions
 */
export async function validateFileType(
  req: UploadRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'No file uploaded',
      });
      return;
    }

    const assetType = req.assetType || 'MAP';
    const filePath = req.file.path;

    // Check file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Uploaded file not found',
      });
      return;
    }

    // Get MIME type from file content (magic bytes)
    const fileType = await fileTypeFromFile(filePath);

    // Special case: PDFs and some audio files may not be detected by file-type
    // Verify by extension for these cases
    const ext = path.extname(req.file.originalname).toLowerCase();
    const isPDF = ext === '.pdf';
    const isMP3 = ext === '.mp3';
    const isTextDocument = assetType === 'DOCUMENT' && (ext === '.txt' || ext === '.md');

    // If file-type couldn't detect type, check if it's a known exception
    if (!fileType) {
      if (isPDF && assetType === 'MAP') {
        // PDF for maps is allowed
        next();
        return;
      } else if (isMP3 && assetType === 'AUDIO') {
        // MP3 for audio is allowed
        next();
        return;
      } else if (isTextDocument && (await isPlainTextFile(filePath))) {
        // Plain text and Markdown have no magic bytes, so file-type cannot
        // identify them and they always land here. The extension is not
        // trusted on its own: the bytes have to prove they are text. A PDF
        // document does not need this branch, because file-type identifies a
        // real PDF and it passes the MIME check below like any other file.
        next();
        return;
      } else {
        // Unknown file type
        await deleteFile(filePath);
        res.status(400).json({
          error: 'Validation Error',
          message: 'Could not determine file type. File may be corrupted or invalid.',
        });
        return;
      }
    }

    // Validate MIME type against allowed types for this asset
    if (!isAllowedMimeType(assetType, fileType.mime)) {
      // Delete the file
      await deleteFile(filePath);

      res.status(400).json({
        error: 'Validation Error',
        message: `Invalid file type. ${assetType} files must be one of: ${getAllowedExtensionsString(assetType)}`,
      });
      return;
    }

    // File is valid, proceed
    next();
  } catch (error) {
    logger.error('Error validating file type', { err: error });

    // Attempt to delete the file if it exists
    if (req.file?.path) {
      try {
        await deleteFile(req.file.path);
      } catch (deleteError) {
        logger.error('Error deleting invalid file', { err: deleteError });
      }
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate file type',
    });
  }
}

/**
 * The allowed extensions for an error message, read from the one table that
 * decides them. This used to be a hand-written list of format names that had
 * drifted from the real list; extensions are also what a person recognises.
 */
function getAllowedExtensionsString(assetType: AssetType): string {
  return ALLOWED_EXTENSIONS[assetType].join(', ');
}

/**
 * Validate file size explicitly (in addition to multer's limit)
 * Useful for custom error messages or additional checks
 */
export async function validateFileSize(
  req: UploadRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'No file uploaded',
      });
      return;
    }

    const filePath = req.file.path;
    const stats = await fs.stat(filePath);
    const fileSizeInBytes = stats.size;

    // Get size limit for asset type (resolved from MAX_<TYPE>_SIZE_MB at startup)
    const assetType = req.assetType || 'MAP';
    const limit = getFileSizeLimit(assetType);

    if (fileSizeInBytes > limit) {
      // Delete the file
      await deleteFile(filePath);

      const limitMB = (limit / (1024 * 1024)).toFixed(0);
      res.status(400).json({
        error: 'File Too Large',
        message: `${assetType} files must be smaller than ${limitMB}MB`,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error validating file size', { err: error });

    // Attempt to delete the file if it exists
    if (req.file?.path) {
      try {
        await deleteFile(req.file.path);
      } catch (deleteError) {
        logger.error('Error deleting oversized file', { err: deleteError });
      }
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate file size',
    });
  }
}
