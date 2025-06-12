const fileStorage = require('../services/fileStorage');

class FileController {
    // Upload a file
    static async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ 
                    success: false,
                    error: 'No file uploaded' 
                });
            }

            const fileData = {
                buffer: req.file.buffer,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            };

            const savedFile = await fileStorage.addFile(fileData, {
                name: req.file.originalname,
                uploadedBy: req.user.userId,
                metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
            });

            res.status(201).json({
                success: true,
                data: {
                    cid: savedFile.cid,
                    name: savedFile.name,
                    size: savedFile.size,
                    mimetype: savedFile.mimetype,
                    uploadedAt: savedFile.uploadedAt,
                    url: `/api/files/${savedFile.cid}`
                }
            });

        } catch (error) {
            console.error('File upload error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to upload file',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Get file by CID
    static async getFile(req, res) {
        try {
            const file = await fileStorage.getFile(req.params.cid);
            
            if (!file) {
                return res.status(404).json({ 
                    success: false,
                    error: 'File not found' 
                });
            }

            // Set appropriate headers
            res.set({
                'Content-Type': file.mimetype,
                'Content-Length': file.size,
                'Content-Disposition': `inline; filename="${file.originalName || 'file'}"`,
                'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
            });

            // Send the file data
            res.send(file.data.buffer || file.data);

        } catch (error) {
            console.error('File retrieval error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to retrieve file',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // List files
    static async listFiles(req, res) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            // Only show files uploaded by the current user
            const query = { uploadedBy: req.user.userId };
            
            const [files, total] = await Promise.all([
                fileStorage.listFiles(query, { 
                    sort: { uploadedAt: -1 },
                    limit: parseInt(limit),
                    skip: skip
                }),
                fileStorage.countFiles(query)
            ]);

            res.json({
                success: true,
                data: files,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            console.error('Error listing files:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to list files',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    // Delete a file
    static async deleteFile(req, res) {
        try {
            const deleted = await fileStorage.deleteFile(
                req.params.cid, 
                req.user.userId
            );

            if (!deleted) {
                return res.status(404).json({ 
                    success: false,
                    error: 'File not found' 
                });
            }

            res.status(204).send();

        } catch (error) {
            console.error('File deletion error:', error);
            
            if (error.status === 403) {
                return res.status(403).json({ 
                    success: false,
                    error: 'Not authorized to delete this file' 
                });
            }
            
            res.status(500).json({ 
                success: false,
                error: 'Failed to delete file',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = FileController;
