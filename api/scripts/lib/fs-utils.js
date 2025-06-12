const fs = require('fs').promises;
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');
const chokidar = require('chokidar');
const archiver = require('archiver');
const extract = require('extract-zip');
const tar = require('tar');
const logger = require('./logger');
const { AppError } = require('./error-utils');

const pipeline = promisify(require('stream').pipeline);

class FSUtils {
  /**
   * Check if a path exists
   */
  static async exists(path) {
    try {
      await fs.access(path);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Ensure a directory exists (create if it doesn't)
   */
  static async ensureDir(dirPath, options = {}) {
    const { mode = 0o777, recursive = true } = options;
    
    try {
      await fs.mkdir(dirPath, { mode, recursive });
      return true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        // Check if it's actually a directory
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          throw new AppError(`Path exists but is not a directory: ${dirPath}`, 500, 'NOT_A_DIRECTORY');
        }
        return false;
      }
      throw error;
    }
  }

  /**
   * Read a file as UTF-8
   */
  static async readFile(filePath, options = {}) {
    const { encoding = 'utf8', ...rest } = options;
    return fs.readFile(filePath, { encoding, ...rest });
  }

  /**
   * Write data to a file
   */
  static async writeFile(filePath, data, options = {}) {
    const { encoding = 'utf8', mode = 0o666, flag = 'w', ...rest } = options;
    
    // Ensure directory exists
    await this.ensureDir(path.dirname(filePath));
    
    return fs.writeFile(filePath, data, { encoding, mode, flag, ...rest });
  }

  /**
   * Read a JSON file
   */
  static async readJson(filePath, options = {}) {
    const content = await this.readFile(filePath, options);
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new AppError(
        `Failed to parse JSON file: ${filePath}`,
        400,
        'INVALID_JSON',
        { originalError: error.message }
      );
    }
  }

  /**
   * Write data as JSON to a file
   */
  static async writeJson(filePath, data, options = {}) {
    const { space = 2, ...rest } = options;
    const content = JSON.stringify(data, null, space);
    return this.writeFile(filePath, content, rest);
  }

  /**
   * Copy a file or directory
   */
  static async copy(src, dest, options = {}) {
    const {
      overwrite = true,
      preserveTimestamps = true,
      recursive = true,
      filter = null,
    } = options;

    const srcStat = await fs.stat(src);
    
    // Handle directory copy
    if (srcStat.isDirectory()) {
      if (!recursive) {
        throw new AppError('Cannot copy directory without recursive flag', 400, 'RECURSIVE_REQUIRED');
      }
      
      await this.ensureDir(dest);
      
      const entries = await fs.readdir(src, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        // Apply filter if provided
        if (filter && !(await filter(srcPath, destPath, entry))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await this.copy(srcPath, destPath, options);
        } else {
          await this.copyFile(srcPath, destPath, { overwrite, preserveTimestamps });
        }
      }
      
      return;
    }
    
    // Handle file copy
    await this.copyFile(src, dest, { overwrite, preserveTimestamps });
  }

  /**
   * Copy a file
   */
  static async copyFile(src, dest, options = {}) {
    const { overwrite = true, preserveTimestamps = true } = options;
    
    // Check if destination exists
    if (!overwrite) {
      try {
        await fs.access(dest);
        return false; // Skip if file exists and overwrite is false
      } catch (error) {
        // File doesn't exist, continue with copy
      }
    }
    
    // Ensure destination directory exists
    await this.ensureDir(path.dirname(dest));
    
    // Copy the file
    await fs.copyFile(src, dest);
    
    // Preserve timestamps
    if (preserveTimestamps) {
      const stat = await fs.stat(src);
      await fs.utimes(dest, stat.atime, stat.mtime);
    }
    
    return true;
  }

  /**
   * Move a file or directory
   */
  static async move(src, dest, options = {}) {
    const { overwrite = true } = options;
    
    try {
      await fs.rename(src, dest);
      return true;
    } catch (error) {
      if (error.code === 'EXDEV') {
        // Cross-device move, use copy + delete
        await this.copy(src, dest, options);
        await this.remove(src, { recursive: true });
        return true;
      } else if (error.code === 'ENOENT') {
        throw new AppError(`Source not found: ${src}`, 404, 'SOURCE_NOT_FOUND');
      } else if (error.code === 'EEXIST' && !overwrite) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Remove a file or directory
   */
  static async remove(path, options = {}) {
    const { recursive = false, force = false } = options;
    
    try {
      await fs.rm(path, { recursive, force });
      return true;
    } catch (error) {
      if (error.code === 'ENOENT' && force) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List directory contents
   */
  static async readdir(dirPath, options = {}) {
    const { 
      withFileTypes = false, 
      recursive = false, 
      filter = null,
      fullPath = false,
    } = options;
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let result = [];
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      // Apply filter if provided
      if (filter && !(await filter(entryPath, entry))) {
        continue;
      }
      
      if (recursive && entry.isDirectory()) {
        const subEntries = await this.readdir(entryPath, { 
          withFileTypes, 
          recursive: true, 
          filter,
          fullPath: true,
        });
        
        result = [...result, ...subEntries];
      }
      
      if (withFileTypes) {
        result.push(fullPath ? { ...entry, path: entryPath } : entry);
      } else {
        result.push(fullPath ? entryPath : entry.name);
      }
    }
    
    return result;
  }

  /**
   * Get file/directory stats
   */
  static async stat(path, options = {}) {
    const { throwIfNotFound = true, followSymlinks = true } = options;
    
    try {
      return followSymlinks ? await fs.stat(path) : await fs.lstat(path);
    } catch (error) {
      if (error.code === 'ENOENT' && !throwIfNotFound) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a symlink
   */
  static async symlink(target, path, type = 'file') {
    await this.ensureDir(path.dirname(path));
    return fs.symlink(target, path, type);
  }

  /**
   * Read a symlink
   */
  static async readlink(path, options = {}) {
    return fs.readlink(path, options);
  }

  /**
   * Create a temporary file or directory
   */
  static async tempFile(options = {}) {
    const { prefix = 'tmp-', suffix = '', dir = require('os').tmpdir() } = options;
    
    await this.ensureDir(dir);
    
    return new Promise((resolve, reject) => {
      require('tmp').file({
        mode: 0o644,
        prefix,
        postfix: suffix,
        dir,
        keep: false,
        discardDescriptor: true,
      }, (err, path, fd, cleanup) => {
        if (err) return reject(err);
        
        // Return an object with the path and a cleanup function
        resolve({
          path,
          fd,
          cleanup,
          async dispose() {
            try {
              await this.cleanup();
            } catch (e) {
              logger.warn(`Failed to cleanup temporary file: ${path}`, e);
            }
          }
        });
      });
    });
  }

  /**
   * Create a temporary directory
   */
  static async tempDir(options = {}) {
    const { prefix = 'tmp-', dir = require('os').tmpdir() } = options;
    
    await this.ensureDir(dir);
    
    return new Promise((resolve, reject) => {
      require('tmp').dir({
        mode: 0o755,
        prefix,
        dir,
        keep: false,
        unsafeCleanup: true,
      }, (err, path, cleanup) => {
        if (err) return reject(err);
        
        // Return an object with the path and a cleanup function
        resolve({
          path,
          cleanup,
          async dispose() {
            try {
              await this.cleanup();
            } catch (e) {
              logger.warn(`Failed to cleanup temporary directory: ${path}`, e);
            }
          }
        });
      });
    });
  }

  /**
   * Watch a file or directory for changes
   */
  static watch(path, options = {}) {
    const {
      recursive = true,
      persistent = true,
      ignoreInitial = true,
      ignored = null,
      usePolling = false,
      interval = 100,
      binaryInterval = 300,
      alwaysStat = false,
      depth = undefined,
      awaitWriteFinish = false,
      ignorePermissionErrors = true,
      atomic = true,
    } = options;
    
    const watcher = chokidar.watch(path, {
      persistent,
      ignoreInitial,
      ignored,
      followSymlinks: true,
      cwd: '.',
      disableGlobbing: false,
      usePolling,
      interval,
      binaryInterval,
      alwaysStat,
      depth,
      awaitWriteFinish,
      ignorePermissionErrors,
      atomic,
      ...(typeof path === 'string' && { recursive }),
    });
    
    return {
      on: watcher.on.bind(watcher),
      once: watcher.once.bind(watcher),
      add: watcher.add.bind(watcher),
      unwatch: watcher.unwatch.bind(watcher),
      getWatched: watcher.getWatched.bind(watcher),
      close: () => {
        return watcher.close();
      },
    };
  }

  /**
   * Calculate file hash
   */
  static async hashFile(filePath, algorithm = 'sha256', encoding = 'hex') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest(encoding)));
      stream.on('error', reject);
    });
  }

  /**
   * Compare two files
   */
  static async compareFiles(file1, file2, options = {}) {
    const { compareContent = true, algorithm = 'sha256' } = options;
    
    if (!compareContent) {
      const [stat1, stat2] = await Promise.all([
        this.stat(file1, { throwIfNotFound: true }),
        this.stat(file2, { throwIfNotFound: true }),
      ]);
      
      return stat1.size === stat2.size && stat1.mtime.getTime() === stat2.mtime.getTime();
    }
    
    const [hash1, hash2] = await Promise.all([
      this.hashFile(file1, algorithm),
      this.hashFile(file2, algorithm),
    ]);
    
    return hash1 === hash2;
  }

  /**
   * Create a zip archive
   */
  static async createZip(files, outputPath, options = {}) {
    const { cwd = process.cwd(), level = 9 } = options;
    
    await this.ensureDir(path.dirname(outputPath));
    
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level } });
      
      output.on('close', () => resolve(outputPath));
      archive.on('warning', reject);
      archive.on('error', reject);
      
      archive.pipe(output);
      
      // Add files to archive
      if (Array.isArray(files)) {
        files.forEach(file => {
          const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
          const nameInArchive = path.relative(cwd, filePath);
          archive.file(filePath, { name: nameInArchive });
        });
      } else if (typeof files === 'object') {
        // Object mapping destination paths to source paths
        Object.entries(files).forEach(([nameInArchive, filePath]) => {
          const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
          archive.file(fullPath, { name: nameInArchive });
        });
      } else {
        throw new AppError('Invalid files parameter', 400, 'INVALID_FILES_PARAM');
      }
      
      archive.finalize();
    });
  }

  /**
   * Extract a zip archive
   */
  static async extractZip(zipPath, outputDir, options = {}) {
    const { overwrite = true } = options;
    
    await this.ensureDir(outputDir);
    
    try {
      await extract(zipPath, { dir: outputDir });
      return true;
    } catch (error) {
      if (!overwrite) {
        throw error;
      }
      
      // If overwrite is true, try to remove existing files and retry
      await this.remove(outputDir, { recursive: true });
      await this.ensureDir(outputDir);
      await extract(zipPath, { dir: outputDir });
      return true;
    }
  }

  /**
   * Create a tar archive
   */
  static async createTar(files, outputPath, options = {}) {
    const { cwd = process.cwd(), gzip = false, level = 9 } = options;
    
    await this.ensureDir(path.dirname(outputPath));
    
    const fileList = Array.isArray(files) ? files : [files];
    const filePaths = fileList.map(file => 
      path.isAbsolute(file) ? file : path.join(cwd, file)
    );
    
    await tar.c({
      gzip,
      file: outputPath,
      cwd,
      ...(gzip && { gzip: { level } }),
    }, fileList);
    
    return outputPath;
  }

  /**
   * Extract a tar archive
   */
  static async extractTar(tarPath, outputDir, options = {}) {
    const { strip = 0, gzip = false } = options;
    
    await this.ensureDir(outputDir);
    
    await tar.x({
      file: tarPath,
      cwd: outputDir,
      gzip,
      strip,
    });
    
    return outputDir;
  }

  /**
   * Find files matching a pattern
   */
  static async findFiles(dir, pattern, options = {}) {
    const { recursive = true, ignore = [], absolute = true } = options;
    
    const globOptions = {
      cwd: dir,
      nodir: true,
      dot: false,
      absolute,
      ...(recursive ? {} : { maxDepth: 1 }),
      ignore: Array.isArray(ignore) ? ignore : [ignore],
    };
    
    const glob = require('fast-glob');
    return glob(pattern, globOptions);
  }

  /**
   * Find files by content
   */
  static async findInFiles(dir, search, options = {}) {
    const { 
      pattern = '**/*',
      recursive = true, 
      ignoreCase = false, 
      wholeWord = false,
      multiline = false,
      includeLineNumbers = false,
      maxResults = 1000,
      encoding = 'utf8',
    } = options;
    
    const files = await this.findFiles(dir, pattern, { recursive });
    const results = [];
    
    // Create regex from search string
    let searchRegex;
    if (search instanceof RegExp) {
      searchRegex = search;
    } else {
      let flags = 'gm';
      if (ignoreCase) flags += 'i';
      if (multiline) flags += 'm';
      
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escapedSearch}\\b` : escapedSearch;
      searchRegex = new RegExp(pattern, flags);
    }
    
    // Search in each file
    for (const file of files) {
      if (results.length >= maxResults) break;
      
      try {
        const content = await this.readFile(file, { encoding });
        const lines = content.split(/\r?\n/);
        const matches = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match;
          
          while ((match = searchRegex.exec(line)) !== null) {
            matches.push({
              line: i + 1,
              column: match.index + 1,
              match: match[0],
              ...(includeLineNumbers && { lineText: line.trim() }),
            });
            
            if (results.length + matches.length >= maxResults) break;
            
            // Prevent infinite loops for zero-length matches
            if (match.index === searchRegex.lastIndex) {
              searchRegex.lastIndex++;
            }
          }
          
          if (results.length + matches.length >= maxResults) break;
        }
        
        if (matches.length > 0) {
          results.push({
            file,
            matches,
            totalMatches: matches.length,
          });
        }
      } catch (error) {
        logger.warn(`Error searching in file ${file}:`, error);
      }
    }
    
    return {
      results,
      totalResults: results.reduce((sum, result) => sum + result.totalMatches, 0),
      truncated: results.length >= maxResults,
    };
  }
}

module.exports = FSUtils;
