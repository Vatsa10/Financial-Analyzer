module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      hasOpenAIKey: hasOpenAIKey,
      platform: process.platform
    },
    message: 'Financial LLM Analyzer API is running'
  });
}; 