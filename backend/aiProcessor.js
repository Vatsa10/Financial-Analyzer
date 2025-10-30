const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
// Using OpenAI embeddings through OpenRouter
// Using a different embeddings model since OpenRouter doesn't support embeddings directly
const { HuggingFaceInferenceEmbeddings } = require('@langchain/community/embeddings/hf');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');

// Clean text by removing noise
const cleanText = (text) => {
  return text
    .replace(/Page\\s+\\d+\\s+of\\s+\\d+/gi, '')
    .replace(/^\\s*[A-Z\\s]+\\s*$/gm, '')
    .replace(/\\s+/g, ' ')
    .replace(/\\n+/g, '\\n')
    .trim();
};

// Split text into semantic chunks
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

// Create vector store from chunks
const createVectorStore = async (documents) => {
  // Using HuggingFace embeddings with API key
  const embeddings = new HuggingFaceInferenceEmbeddings({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    apiKey: process.env.HF_API_KEY, // Your HuggingFace API key
    apiUrl: 'https://api-inference.huggingface.co/pipeline/feature-extraction',
    maxRetries: 3
  });
  const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  return vectorStore;
};

// Query relevant chunks for each section
const queryRelevantChunks = async (vectorStore, query, limit = 4) => {
  const results = await vectorStore.similaritySearch(query, limit);
  return results.map(doc => doc.pageContent);
};

// Generate section-specific content
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
- Present ONLY the key financial data points, each on its own line with a bullet point.

Correct formatting example:
• Revenue increased from $24.9 billion in Q3 2023 to $30.4 billion in Q3 2024, representing a 22% year-over-year growth.
• Net income improved from $6.4 billion in Q3 2023 to $8.0 billion in Q3 2024, showing a 25% increase.
• Operating margin expanded from 25.6% to 26.2%, demonstrating improved operational efficiency.`,
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
      'HTTP-Referer': 'https://your-website-url.com', // Replace with your actual website URL
      'X-Title': 'Financial LLM Analyzer' // Your app name
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

  // Post-processing fix for all sections to guarantee correct formatting
  if (content) {
    // Only replace '-' bullet points with '•' for consistency, preserve everything else
    content = content.replace(/^\s*-\s*/gm, '• ');
    // Ensure bullet points are on separate lines
    content = content.replace(/•\s*/g, '\n• ').trim();
  }

  return content;
};

// Main function to generate financial analysis sections
const generateReportSections = async (extractedText, companyName, apiKey) => {
  try {
    const cleanedText = cleanText(extractedText);
    const documents = await splitTextIntoSemanticChunks(cleanedText);
    const vectorStore = await createVectorStore(documents);

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

const answerQuestion = async (vectorStore, question, companyName, apiKey) => {
  try {
    const relevantChunks = await queryRelevantChunks(vectorStore, question, 3);

    const answerPrompt = `You are a financial analyst answering a question about ${companyName} based on their financial document. 

    Question: ${question}
    
    Relevant Information from the Financial Document:
    ${relevantChunks.join('\n\n')}
    
    Provide a clear, concise answer (2-3 sentences maximum) based only on the information available. Be specific with numbers and details when available. If the information is not available in the document, clearly state that.`;

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
            content: 'You are a professional financial analyst specializing in analyzing financial documents. Provide accurate, concise answers based strictly on the provided document content.'
          },
          {
            role: 'user',
            content: answerPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Unable to provide answer based on available information.';
  } catch (error) {
    console.error('Error in Q&A processing:', error);
    throw error;
  }
};

module.exports = { generateReportSections, answerQuestion }; 