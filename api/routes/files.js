const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileController = require('../controllers/fileController');
const upload = multer();

// Auth middleware (assume JWT, as used elsewhere)
const { authenticateJWT } = require('../middleware/authMiddleware');

// List files (bucket view, paginated)
router.get('/', authenticateJWT, FileController.listFiles);

// Get a file by CID
router.get('/:cid', authenticateJWT, FileController.getFile);

// Upload a new file
router.post('/', authenticateJWT, upload.single('file'), FileController.uploadFile);

// Delete a file by CID
router.delete('/:cid', authenticateJWT, FileController.deleteFile);

// Delete a bucket and all its files
router.delete('/bucket/:bucketName', authenticateJWT, FileController.deleteBucket);

// Create a new bucket
router.post('/bucket', authenticateJWT, FileController.createBucket);

module.exports = router;
