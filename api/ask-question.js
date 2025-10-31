const { loadVectorStore, getCacheInfo } = require('./vector-cache');
const {
  answerQuestionWithAgents,
  conversationStore
} = require('../backend/agenticWorkflow');

const getConversationKey = (companyName) => {
  return `company:${(companyName || 'unknown').toLowerCase()}`;
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
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  const hfKey = process.env.HF_API_KEY;

  // Detailed parameter validation
  const missingParams = [];
  if (!filename) missingParams.push('filename');
  if (!question) missingParams.push('question');
  if (!companyName) missingParams.push('companyName');
  if (!apiKey) missingParams.push('OPENROUTER_API_KEY or OPENAI_API_KEY (environment variable)');
  if (!hfKey) missingParams.push('HF_API_KEY (environment variable)');

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
      details: `Expected: filename, question, companyName, and required API keys (HF_API_KEY plus OpenRouter/OpenAI)`
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
    const conversationKey = getConversationKey(companyName);
    const existingHistory = conversationStore.get(conversationKey) || [];

    const { answer, conversationHistory } = await answerQuestionWithAgents({
      vectorStore,
      question,
      companyName,
      apiKey,
      conversationHistory: existingHistory
    });

    conversationStore.set(conversationKey, conversationHistory);

    res.status(200).json({ answer });
  } catch (error) {
    console.error('Error in Q&A:', error.message);
    res.status(500).json({ error: 'Failed to get an answer.' });
  }
}; 