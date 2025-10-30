const { loadVectorStore, getCacheInfo } = require('./vector-cache');

// Query relevant chunks for each section
const queryRelevantChunks = async (vectorStore, query, limit = 4) => {
  const results = await vectorStore.similaritySearch(query, limit);
  return results.map(doc => doc.pageContent);
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
    return data.choices[0]?.message?.content || 'Answer not available';
  } catch (error) {
    console.error('Error in Q&A:', error);
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

  const { filename, question, companyName } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  // Detailed parameter validation
  const missingParams = [];
  if (!filename) missingParams.push('filename');
  if (!question) missingParams.push('question');
  if (!companyName) missingParams.push('companyName');
  if (!apiKey) missingParams.push('OPENAI_API_KEY (environment variable)');

  if (missingParams.length > 0) {
    console.error('Missing required parameters for Q&A:', missingParams);
    console.error('Received parameters:', {
      filename: !!filename,
      question: !!question,
      companyName: !!companyName,
      apiKey: !!apiKey
    });
    return res.status(400).json({ 
      error: `Missing required parameters: ${missingParams.join(', ')}`,
      details: `Expected: filename, question, companyName, and OPENAI_API_KEY environment variable`
    });
  }

  console.log(`Attempting to load vector store for filename: ${filename}`);
  const vectorStore = await loadVectorStore(filename, apiKey);
  if (!vectorStore) {
    console.error(`Vector store not found for filename: ${filename}`);
    const cacheInfo = getCacheInfo();
    console.error('Cache info:', cacheInfo);
    return res.status(404).json({ 
      error: 'Analysis context not found. Please generate a report first.',
      debug: {
        filename,
        ...cacheInfo
      }
    });
  }

  try {
    const answer = await answerQuestion(vectorStore, question, companyName, apiKey);
    res.status(200).json({ answer });
  } catch (error) {
    console.error('Error in Q&A:', error.message);
    res.status(500).json({ error: 'Failed to get an answer.' });
  }
}; 