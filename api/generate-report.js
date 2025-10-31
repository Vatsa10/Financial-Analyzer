const pdf = require('pdf-parse');
const {
  prepareDocuments,
  createVectorStore,
  generateSectionsWithAgents,
  conversationStore
} = require('../backend/agenticWorkflow');
const { saveVectorStore } = require('./vector-cache');

const SECTION_ORDER = ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'];

// PDF Processing functionality (inlined from backend)
const extractTextFromPDF = async (input) => {
  try {
    let dataBuffer;
    
    // Check if input is a file path (string) or a buffer
    if (typeof input === 'string') {
      // Original behavior for file path
      dataBuffer = require('fs').readFileSync(input);
    } else if (Buffer.isBuffer(input)) {
      // New behavior for buffer input
      dataBuffer = input;
    } else {
      throw new Error('Input must be a file path (string) or Buffer');
    }
    
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF.');
  }
};

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

  console.log('=== FINANCIAL DOCUMENT ANALYSIS STARTED ===');
  
  const { filename, companyName, fileBuffer } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  const hfKey = process.env.HF_API_KEY;

  // Detailed parameter validation with specific error messages
  const missingParams = [];
  if (!filename) missingParams.push('filename');
  if (!companyName) missingParams.push('companyName');
  if (!fileBuffer) missingParams.push('fileBuffer');
  if (!apiKey) missingParams.push('OPENROUTER_API_KEY or OPENAI_API_KEY (environment variable)');
  if (!hfKey) missingParams.push('HF_API_KEY (environment variable)');

  if (missingParams.length > 0) {
    console.error('Missing required parameters:', missingParams);
    console.error('Received parameters:', {
      filename: !!filename,
      companyName: !!companyName,
      fileBuffer: !!fileBuffer ? `${fileBuffer.length} chars` : 'missing',
      apiKey: !!apiKey
    });
    return res.status(400).json({ 
      error: `Missing required parameters: ${missingParams.join(', ')}`,
      details: `Expected: filename, companyName, fileBuffer, and required API keys (HF_API_KEY plus OpenRouter/OpenAI)`
    });
  }

  try {
    // Convert base64 back to buffer
    const pdfBuffer = Buffer.from(fileBuffer, 'base64');
    
    // 1. Extract text from PDF buffer
    console.log('Step 1: Starting PDF text extraction...');
    const extractedText = await extractTextFromPDF(pdfBuffer);
    console.log('Text extraction completed. Length:', extractedText ? extractedText.length : 0);
    
    if (!extractedText) {
      throw new Error('Text extraction returned empty.');
    }

    // 2. Generate report sections using agentic workflow
    console.log('Step 2: Starting agentic LLM-powered financial analysis...');

    const { documents } = await prepareDocuments(extractedText);
    const vectorStore = await createVectorStore(documents);

    const conversationKey = `company:${(companyName || 'unknown').toLowerCase()}`;
    const existingHistory = conversationStore.get(conversationKey) || [];

    const { sections, conversationHistory } = await generateSectionsWithAgents({
      sectionTypes: SECTION_ORDER,
      documents,
      vectorStore,
      companyName,
      apiKey,
      conversationHistory: existingHistory
    });

    conversationStore.set(conversationKey, conversationHistory);
    console.log('Financial analysis completed. Sections:', Object.keys(sections));

    // Save the vector store for Q&A
    await saveVectorStore(filename, vectorStore);
    console.log(`Vector store for ${filename} saved for Q&A.`);

    // 3. Send report back to client
    console.log('Step 3: Sending financial analysis to client...');
    res.status(200).json(sections);
    console.log('=== FINANCIAL DOCUMENT ANALYSIS COMPLETED SUCCESSFULLY ===');

  } catch (error) {
    console.error('=== ERROR DURING FINANCIAL ANALYSIS ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Failed to generate financial analysis: ${error.message}` });
  }
};