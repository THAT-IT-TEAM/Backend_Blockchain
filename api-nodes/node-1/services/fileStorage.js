const Datastore = require('nedb');
const path = require('path');
const fs = require('fs');

class FileStorageService {
    constructor() {
        this.db = null;
        this.initializeDatabase();
    }

    initializeDatabase() {
        try {
            // Create data directory if it doesn't exist
            const dataDir = path.join(__dirname, '..', 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Initialize database
            this.db = new Datastore({ 
                filename: path.join(dataDir, 'files.db'),
                autoload: true,
                timestampData: true
            });
            
            // Create indexes
            this.db.ensureIndex({ fieldName: 'cid', unique: true });
            this.db.ensureIndex({ fieldName: 'uploadedBy' });
            
            console.log('File storage service initialized');
            
        } catch (error) {
            console.error('Failed to initialize file storage:', error);
            throw error;
        }
    }

    // Generate a simple CID (Content ID)
    generateCID() {
        return `bafy${Date.now().toString(16)}`;
    }

    // Add a file to storage
    async addFile(fileData, meta = {}) {
        return new Promise((resolve, reject) => {
            const doc = {
                cid: this.generateCID(),
                ...meta,
                data: fileData,
                size: fileData.size || fileData.length || 0,
                mimetype: fileData.mimetype || 'application/octet-stream',
                originalName: fileData.originalname || 'file',
                uploadedAt: new Date()
            };
            
            this.db.insert(doc, (err, newDoc) => {
                if (err) return reject(err);
                resolve(newDoc);
            });
        });
    }
    
    // Get a file by CID
    async getFile(cid) {
        return new Promise((resolve, reject) => {
            this.db.findOne({ cid }, (err, doc) => {
                if (err) return reject(err);
                resolve(doc);
            });
        });
    }
    
    // List files with optional query
    async listFiles(query = {}, options = {}) {
        return new Promise((resolve, reject) => {
            let cursor = this.db.find(query);
            
            // Apply sorting
            if (options.sort) {
                cursor = cursor.sort(options.sort);
            }
            
            // Apply pagination
            if (options.limit) {
                cursor = cursor.limit(options.limit);
            }
            if (options.skip) {
                cursor = cursor.skip(options.skip);
            }
            
            cursor.exec((err, docs) => {
                if (err) return reject(err);
                
                // Remove file data from list view
                const result = docs.map(({ cid, name, size, mimetype, uploadedAt, uploadedBy }) => ({
                    cid,
                    name: name || 'Unnamed',
                    size,
                    mimetype,
                    uploadedAt,
                    uploadedBy,
                    url: `/api/files/${cid}`
                }));
                
                resolve(result);
            });
        });
    }
    
    // Delete a file by CID
    async deleteFile(cid, userId) {
        return new Promise((resolve, reject) => {
            // First verify the file exists and belongs to the user
            this.db.findOne({ cid }, (err, file) => {
                if (err) return reject(err);
                if (!file) return resolve(false);
                
                // Check ownership if userId is provided
                if (userId && file.uploadedBy !== userId) {
                    const error = new Error('Not authorized to delete this file');
                    error.status = 403;
                    return reject(error);
                }
                
                // Delete the file
                this.db.remove({ cid }, {}, (err, numRemoved) => {
                    if (err) return reject(err);
                    resolve(numRemoved > 0);
                });
            });
        });
    }
    
    // Count files matching a query
    async countFiles(query = {}) {
        return new Promise((resolve, reject) => {
            this.db.count(query, (err, count) => {
                if (err) return reject(err);
                resolve(count);
            });
        });
    }
}

// Export a singleton instance
module.exports = new FileStorageService();
