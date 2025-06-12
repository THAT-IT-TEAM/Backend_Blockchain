const path = require('path');

module.exports = {
  // Local file storage configuration
  local: {
    enabled: true,
    type: 'local',
    directory: path.join(process.cwd(), 'uploads'),
    baseUrl: '/uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'text/plain',
      'application/json'
    ]
  },
  
  // AWS S3 Configuration (optional)
  s3: {
    enabled: false,
    type: 's3',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'private',
    endpoint: process.env.AWS_S3_ENDPOINT
  },
  
  // IPFS Configuration (optional)
  ipfs: {
    enabled: false,
    type: 'ipfs',
    host: process.env.IPFS_HOST || 'ipfs.infura.io',
    port: process.env.IPFS_PORT || 5001,
    protocol: process.env.IPFS_PROTOCOL || 'https',
    projectId: process.env.IPFS_PROJECT_ID,
    projectSecret: process.env.IPFS_PROJECT_SECRET
  }
};
