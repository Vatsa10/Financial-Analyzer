require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { extractTextFromPDF } = require('./pdfProcessor');
const ragOrchestrator = require('./ragOrchestrator');

const app = express();
const port = process.env.PORT || 3001;

// Simple in-memory cache for vector stores with mode information
const vectorStoreCache = new Map();

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up Multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Use a timestamp to make filenames unique
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Configure CORS to allow requests from frontend
const allowedOrigins = [
  'http://localhost:8080', // Local development
  'http://localhost:5173', // Vite default port
  'https://financial-analyzer-nine.vercel.app', // Vercel frontend
  process.env.FRONTEND_URL, // Production frontend URL from environment variable
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      // For now, allow all origins to avoid blocking issues
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/fetch-pdf', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    console.log('Fetching PDF from URL:', url);
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('PDF fetched successfully, size:', response.data.length);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', response.data.length);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Error fetching PDF:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
    res.status(500).send(`Failed to fetch PDF: ${error.message}`);
  }
});

// New endpoint for file uploads
app.post('/api/upload', upload.single('report'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  console.log('File uploaded:', req.file);

  // Respond with information about the uploaded file
  res.status(200).json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path
  });
});

// Get available RAG modes
app.get('/api/rag-modes', (req, res) => {
  try {
    const modes = ragOrchestrator.getAllStrategies();
    res.status(200).json({ modes });
  } catch (error) {
    console.error('Error fetching RAG modes:', error);
    res.status(500).json({ error: 'Failed to fetch RAG modes' });
  }
});

// New endpoint to trigger report generation with mode selection
app.post('/api/generate-report', async (req, res) => {
  console.log('=== FINANCIAL DOCUMENT ANALYSIS STARTED ===');
  console.log('Request body:', req.body);
  
  const { filename, companyName, mode = 'single' } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (!filename || !companyName || !apiKey) {
    console.error('Missing required parameters:', { filename: !!filename, companyName: !!companyName, apiKey: !!apiKey });
    return res.status(400).send('Missing filename, companyName, or apiKey.');
  }

  const filePath = path.join(__dirname, 'uploads', filename);
  console.log('File path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));
  console.log('Selected mode:', mode);

  try {
    // 1. Extract text from PDF
    console.log('Step 1: Starting PDF text extraction...');
    const extractedText = await extractTextFromPDF(filePath);
    console.log('Text extraction completed. Length:', extractedText ? extractedText.length : 0);
    
    if (!extractedText) {
      throw new Error('Text extraction returned empty.');
    }

    // 2. Generate report sections using selected strategy
    console.log(`Step 2: Starting LLM-powered financial analysis using ${mode} mode...`);
    const result = await ragOrchestrator.generateReport({
      mode,
      extractedText,
      companyName,
      apiKey
    });
    
    console.log('Financial analysis completed. Sections:', Object.keys(result.sections));
    console.log('Mode used:', result.metadata.mode);
    if (result.metadata.fallback) {
      console.log('Fallback occurred from:', result.metadata.originalMode);
    }

    // Cache the vector store for Q&A with mode information
    vectorStoreCache.set(filename, {
      vectorStore: result.vectorStore,
      mode: result.metadata.mode
    });
    console.log(`Vector store for ${filename} cached for Q&A with mode: ${result.metadata.mode}`);

    // 3. Send report back to client
    console.log('Step 3: Sending financial analysis to client...');
    res.status(200).json({
      ...result.sections,
      metadata: result.metadata
    });
    console.log('=== FINANCIAL DOCUMENT ANALYSIS COMPLETED SUCCESSFULLY ===');

  } catch (error) {
    console.error('=== ERROR DURING FINANCIAL ANALYSIS ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR DETAILS ===');
    res.status(500).send(`Failed to generate financial analysis: ${error.message}`);
  } finally {
    // 4. Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Failed to delete temporary file:', filePath, err);
      } else {
        console.log('Successfully deleted temporary file:', filePath);
      }
    });
  }
});

app.post('/api/ask-question', async (req, res) => {
  const { filename, question, companyName } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (!filename || !question || !companyName || !apiKey) {
    return res.status(400).send('Missing required parameters.');
  }

  const cacheEntry = vectorStoreCache.get(filename);
  if (!cacheEntry) {
    return res.status(404).send('Analysis context not found. Please generate a report first.');
  }

  const { vectorStore, mode } = cacheEntry;
  console.log(`Answering question using ${mode} mode`);

  try {
    const result = await ragOrchestrator.answerQuestion({
      mode,
      vectorStore,
      question,
      companyName,
      apiKey
    });
    
    res.status(200).json({
      answer: result.answer,
      mode: result.mode,
      strategyName: result.strategyName,
      fallback: result.fallback || false
    });
  } catch (error) {
    console.error('Error in Q&A:', error.message);
    res.status(500).send('Failed to get an answer.');
  }
});

app.listen(port, () => {
  console.log(`Financial Analyzer Backend Server running on http://localhost:${port}`);
}); 