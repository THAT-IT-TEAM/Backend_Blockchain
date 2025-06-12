const fs = require('fs').promises;
const path = require('path');
const { createGzip, createGunzip } = require('zlib');
const { promisify } = require('util');
const stream = require('stream');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('../config');

const pipeline = promisify(stream.pipeline);

class FileUtils {
  /**
   * Ensure a directory exists
   */
  static async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        logger.error(`Failed to create directory ${dirPath}:`, error);
        throw error;
      }
      return true;
    }
  }

  /**
   * List files in a directory with optional filtering
   */
  static async listFiles(dirPath, options = {}) {
    const {
      recursive = false,
      filter = null,
      fullPath = false,
    } = options;

    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      let result = [];

      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        
        if (file.isDirectory() && recursive) {
          const subFiles = await this.listFiles(fullPath, { recursive, filter, fullPath: true });
          result = result.concat(subFiles);
        } else if (file.isFile()) {
          if (!filter || filter(file.name, fullPath)) {
            result.push(fullPath);
          }
        }
      }

      return fullPath ? result : result.map(f => path.relative(dirPath, f));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      logger.error(`Failed to list files in ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Compress a file using gzip
   */
  static async compressFile(inputPath, outputPath = null, options = {}) {
    const {
      level = 6, // Compression level (0-9)
      deleteOriginal = false,
    } = options;

    const destPath = outputPath || `${inputPath}.gz`;

    try {
      await this.ensureDir(path.dirname(destPath));
      
      const gzip = createGzip({ level });
      const source = fs.createReadStream(inputPath);
      const destination = fs.createWriteStream(destPath);

      await pipeline(source, gzip, destination);

      if (deleteOriginal) {
        await fs.unlink(inputPath);
      }

      const stats = await fs.stat(destPath);
      
      return {
        path: destPath,
        size: stats.size,
        originalSize: (await fs.stat(inputPath)).size,
        ratio: stats.size / (await fs.stat(inputPath)).size,
      };
    } catch (error) {
      logger.error(`Failed to compress file ${inputPath}:`, error);
      throw error;
    }
  }

  /**
   * Decompress a gzipped file
   */
  static async decompressFile(inputPath, outputPath = null, options = {}) {
    const { deleteOriginal = false } = options;
    
    if (!inputPath.endsWith('.gz')) {
      throw new Error('Input file must have a .gz extension');
    }
    
    const destPath = outputPath || inputPath.slice(0, -3); // Remove .gz extension

    try {
      await this.ensureDir(path.dirname(destPath));
      
      const gunzip = createGunzip();
      const source = fs.createReadStream(inputPath);
      const destination = fs.createWriteStream(destPath);

      await pipeline(source, gunzip, destination);

      if (deleteOriginal) {
        await fs.unlink(inputPath);
      }

      const stats = await fs.stat(destPath);
      
      return {
        path: destPath,
        size: stats.size,
        compressedSize: (await fs.stat(inputPath)).size,
      };
    } catch (error) {
      logger.error(`Failed to decompress file ${inputPath}:`, error);
      throw error;
    }
  }

  /**
   * Calculate file hash
   */
  static async getFileHash(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Copy a file
   */
  static async copyFile(source, destination, options = {}) {
    const { overwrite = true, preserveTimestamps = true } = options;
    
    try {
      await this.ensureDir(path.dirname(destination));
      
      if (!overwrite) {
        try {
          await fs.access(destination);
          return { path: destination, skipped: true };
        } catch (error) {
          // File doesn't exist, continue with copy
        }
      }
      
      await fs.copyFile(source, destination);
      
      if (preserveTimestamps) {
        const stats = await fs.stat(source);
        await fs.utimes(destination, stats.atime, stats.mtime);
      }
      
      return { path: destination, skipped: false };
    } catch (error) {
      logger.error(`Failed to copy file from ${source} to ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Move a file
   */
  static async moveFile(source, destination, options = {}) {
    const { overwrite = true } = options;
    
    try {
      await this.ensureDir(path.dirname(destination));
      
      if (!overwrite) {
        try {
          await fs.access(destination);
          return { path: destination, skipped: true };
        } catch (error) {
          // File doesn't exist, continue with move
        }
      }
      
      await fs.rename(source, destination);
      return { path: destination, skipped: false };
    } catch (error) {
      // If move fails (across devices), fall back to copy + delete
      if (error.code === 'EXDEV') {
        logger.debug(`Cross-device move detected, using copy+delete for ${source}`);
        const result = await this.copyFile(source, destination, options);
        if (!result.skipped) {
          await fs.unlink(source);
        }
        return result;
      }
      
      logger.error(`Failed to move file from ${source} to ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Delete files matching a pattern
   */
  static async deleteFiles(pattern, options = {}) {
    const { cwd = process.cwd(), recursive = false, dryRun = false } = options;
    
    try {
      const files = await this.listFiles(cwd, { recursive });
      const matchedFiles = files.filter(file => {
        const relativePath = path.relative(cwd, file);
        return minimatch(relativePath, pattern);
      });
      
      if (dryRun) {
        return { deleted: matchedFiles, skipped: [] };
      }
      
      const results = { deleted: [], failed: [] };
      
      for (const file of matchedFiles) {
        try {
          await fs.unlink(file);
          results.deleted.push(file);
        } catch (error) {
          logger.error(`Failed to delete file ${file}:`, error);
          results.failed.push({ file, error: error.message });
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Failed to delete files matching pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Get file information
   */
  static async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        accessedAt: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymbolicLink: stats.isSymbolicLink(),
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      logger.error(`Failed to get file info for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Watch a directory for changes
   */
  static watchDirectory(dirPath, options = {}) {
    const {
      recursive = true,
      persistent = true,
      ignoreInitial = true,
      debounce = 100,
      onChange = () => {},
      onError = (error) => logger.error('File watch error:', error),
    } = options;
    
    const watcher = fs.watch(dirPath, {
      recursive,
      persistent,
    });
    
    let changeTimeout;
    let changedFiles = new Set();
    
    const handleChange = (eventType, filename) => {
      if (!filename) return;
      
      const filePath = path.join(dirPath, filename);
      changedFiles.add(filePath);
      
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      
      changeTimeout = setTimeout(() => {
        onChange(Array.from(changedFiles));
        changedFiles.clear();
      }, debounce);
    };
    
    watcher.on('change', handleChange);
    watcher.on('error', onError);
    
    // Return cleanup function
    return () => {
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      watcher.close();
    };
  }
}

module.exports = FileUtils;
