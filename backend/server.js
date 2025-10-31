require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { extractTextFromPDF } = require('./pdfProcessor');
const { generateReportSections, answerQuestion } = require('./aiProcessor');

const app = express();
const port = 3001;

// Simple in-memory cache for vector stores
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

app.use(cors());
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

// New endpoint to trigger report generation
app.post('/api/generate-report', async (req, res) => {
  console.log('=== FINANCIAL DOCUMENT ANALYSIS STARTED ===');
  console.log('Request body:', req.body);
  
  const { filename, companyName } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!filename || !companyName || !apiKey) {
    console.error('Missing required parameters:', { filename: !!filename, companyName: !!companyName, apiKey: !!apiKey });
    return res.status(400).send('Missing filename, companyName, or apiKey.');
  }

  const filePath = path.join(__dirname, 'uploads', filename);
  console.log('File path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));

  try {
    // 1. Extract text from PDF
    console.log('Step 1: Starting PDF text extraction...');
    const extractedText = await extractTextFromPDF(filePath);
    console.log('Text extraction completed. Length:', extractedText ? extractedText.length : 0);
    
    if (!extractedText) {
      throw new Error('Text extraction returned empty.');
    }

    // 2. Generate report sections using AI
    console.log('Step 2: Starting LLM-powered financial analysis...');
    const { sections, vectorStore } = await generateReportSections(extractedText, companyName, process.env.OPENROUTER_API_KEY || apiKey);
    console.log('Financial analysis completed. Sections:', Object.keys(sections));

    // Cache the vector store for Q&A
    vectorStoreCache.set(filename, vectorStore);
    console.log(`Vector store for ${filename} cached for Q&A.`);

    // 3. Send report back to client
    console.log('Step 3: Sending financial analysis to client...');
    res.status(200).json(sections);
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

  const vectorStore = vectorStoreCache.get(filename);
  if (!vectorStore) {
    return res.status(404).send('Analysis context not found. Please generate a report first.');
  }

  try {
    const answer = await answerQuestion(vectorStore, question, companyName, apiKey);
    res.status(200).json({ answer });
  } catch (error) {
    console.error('Error in Q&A:', error.message);
    res.status(500).send('Failed to get an answer.');
  }
});

app.listen(port, () => {
  console.log(`Financial Analyzer Backend Server running on http://localhost:${port}`);
}); 