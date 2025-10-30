const pdf = require('pdf-parse');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');
const { saveVectorStore } = require('./vector-cache');

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

// AI Processing functionality (inlined from backend)
const cleanText = (text) => {
  return text
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
    .replace(/^\s*[A-Z\s]+\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
};

const splitTextIntoSemanticChunks = async (text) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 150,
  });
  const chunks = await splitter.splitText(text);
  return chunks.map((chunk, index) => new Document({
    pageContent: chunk,
    metadata: { id: `chunk_${index}` }
  }));
};

const createVectorStore = async (documents, apiKey) => {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    batchSize: 50,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': 'https://your-website-url.com',
        'X-Title': 'Financial LLM Analyzer',
      },
    },
  });
  const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  return vectorStore;
};

const queryRelevantChunks = async (vectorStore, query, limit = 4) => {
  const results = await vectorStore.similaritySearch(query, limit);
  return results.map(doc => doc.pageContent);
};

const generateSectionContent = async (relevantChunks, sectionType, companyName, apiKey) => {
  const sectionPrompts = {
    overview: `You are an expert financial analyst. Your task is to provide a concise overview of ${companyName}'s business model and strategic positioning.
- Focus on the company's core operations, strategic priorities, and competitive advantages.
- Each key point MUST be presented as a separate bullet point (•). THIS IS A STRICT REQUIREMENT.
- Crucially, you must EXCLUDE the following:
  - Specific financial numbers or performance metrics (e.g., revenue, EBITDA, profit).
  - Any third-party opinions, "buy/sell" ratings, or price targets.
- Format as plain text with bullet points using • symbol. Do NOT use markdown formatting.`,
    financialHighlights: `You are an expert financial analyst for the company ${companyName}.
- Your task is to extract and summarize key financial metrics from the provided financial document.
- Each key metric MUST be presented as a separate bullet point (•). THIS IS A STRICT REQUIREMENT.
- For each metric, write a full sentence describing the trend, for example, "Revenue increased from X to Y, representing a Z% growth."
- Do NOT combine multiple facts into one line. Each bullet point should describe one key metric.
- Focus on the most important metrics like revenue, profit, EBITDA, key operational metrics, and relevant financial ratios.
- Present ONLY the key financial data points, each on its own line with a bullet point.`,
    keyRisks: `You are a risk analysis specialist. From the provided financial document, identify and summarize the key business, financial, market, and operational risks for ${companyName}.
- If a "Risk Factors" or "Risk Management" section exists in the document, prioritize information from there.
- Group the risks into logical categories if possible (e.g., Market Risks, Operational Risks, Financial Risks, Regulatory Risks).
- For each risk, provide a concise, one-sentence summary of the potential negative impact.
- Include both company-specific risks and broader industry/market risks that may affect the company.
- Exclude any information about risk mitigation strategies or management's plans to address the risks.
- Format as plain text with bullet points using • symbol. Do NOT use markdown formatting.`,
    managementCommentary: `You are an executive summary writer. Based on the provided financial document, summarize the forward-looking commentary and strategic priorities of ${companyName}'s management.
- Focus on direct statements regarding future plans, growth initiatives, investment strategies, market outlook, and strategic direction.
- Each key point MUST be presented as a separate bullet point (•). THIS IS A STRICT REQUIREMENT.
- Source this information from sections like "Management Discussion & Analysis", "CEO Letter", "Chairman's Message", or executive commentary.
- Crucially, you must EXCLUDE the following:
  - Any financial results or past performance metrics.
  - Any information already identified as a Key Risk.
  - Any third-party opinions, analyst ratings, or price targets.
- Format as plain text with bullet points using • symbol. Do NOT use markdown formatting.`
  };

  const prompt = `${sectionPrompts[sectionType]}

Relevant Information from Financial Document:
${relevantChunks.join('\n\n')}

CRITICAL FORMATTING REQUIREMENTS:
- Use bullet points (•) for lists where specified in the section prompt.
- Each bullet point MUST be on its own separate line.
- Do NOT use markdown formatting (like ** for bold, # for headers, etc.).
- Use plain text only with proper line breaks.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://your-website-url.com',
      'X-Title': 'Financial LLM Analyzer'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: "You are a professional financial analyst specializing in analyzing financial documents including quarterly reports, SEC filings, 10-K/10-Q forms, earnings transcripts, and annual reports. Follow the user's instructions carefully, especially the formatting requirements. Never use markdown formatting - use only plain text with bullet points and line breaks."
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices[0]?.message?.content || 'Analysis not available';

  if (content) {
    content = content.replace(/^\s*-\s*/gm, '• ');
    content = content.replace(/•\s*/g, '\n• ').trim();
  }

  return content;
};

const generateReportSections = async (extractedText, companyName, apiKey) => {
  try {
    const cleanedText = cleanText(extractedText);
    const documents = await splitTextIntoSemanticChunks(cleanedText);
    const vectorStore = await createVectorStore(documents, apiKey);

    const sectionQueries = {
      overview: `company business model strategic positioning operations ${companyName}`,
      financialHighlights: `financial performance metrics revenue profit margins earnings ${companyName}`,
      keyRisks: `risk factors operational financial market regulatory risks ${companyName}`,
      managementCommentary: `management outlook strategy future plans growth initiatives ${companyName}`
    };

    const sectionTypes = ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'];
    
    const sectionPromises = sectionTypes.map(async (sectionType) => {
      const relevantChunks = await queryRelevantChunks(vectorStore, sectionQueries[sectionType]);
      const content = await generateSectionContent(relevantChunks, sectionType, companyName, apiKey);
      return { sectionType, content };
    });

    const sectionResults = await Promise.all(sectionPromises);

    const sections = sectionResults.reduce((acc, { sectionType, content }) => {
      acc[sectionType] = content;
      return acc;
    }, {});

    return { sections, vectorStore };
  } catch (error) {
    console.error('Error in financial document analysis:', error);
    throw error;
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
  const apiKey = process.env.OPENAI_API_KEY;

  // Detailed parameter validation with specific error messages
  const missingParams = [];
  if (!filename) missingParams.push('filename');
  if (!companyName) missingParams.push('companyName');
  if (!fileBuffer) missingParams.push('fileBuffer');
  if (!apiKey) missingParams.push('OPENAI_API_KEY (environment variable)');

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
      details: `Expected: filename, companyName, fileBuffer, and OPENAI_API_KEY environment variable`
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

    // 2. Generate report sections using AI
    console.log('Step 2: Starting LLM-powered financial analysis...');
    const { sections, vectorStore } = await generateReportSections(extractedText, companyName, apiKey);
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