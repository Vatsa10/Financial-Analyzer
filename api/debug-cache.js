const { getCacheInfo } = require('./vector-cache');

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

  try {
    const cacheInfo = getCacheInfo();
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      cache: cacheInfo,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY
      }
    });
  } catch (error) {
    console.error('Debug cache error:', error);
    res.status(500).json({ 
      error: 'Failed to get cache info',
      message: error.message 
    });
  }
};
