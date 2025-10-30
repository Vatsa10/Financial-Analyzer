const multer = require('multer');

// Configure multer for memory storage (Vercel functions are stateless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return new Promise((resolve) => {
    upload.single('report')(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        } else {
          res.status(400).json({ error: err.message || 'File upload failed' });
        }
        resolve();
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        resolve();
        return;
      }

      try {
        // For Vercel, we'll use the buffer directly instead of saving to disk
        const filename = `${Date.now()}-${req.file.originalname}`;
        
        res.status(200).json({
          message: 'File uploaded successfully',
          filename: filename,
          fileBuffer: req.file.buffer.toString('base64'), // Convert to base64 for transfer
          mimetype: req.file.mimetype
        });
        
      } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Failed to process uploaded file' });
      }
      
      resolve();
    });
  });
};

// Disable body parsing for this route
module.exports.config = {
  api: {
    bodyParser: false,
  },
}; 