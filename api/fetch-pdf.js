const axios = require('axios');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
    });

    res.setHeader('Content-Type', 'application/pdf');
    response.data.pipe(res);
  } catch (error) {
    console.error('Error fetching PDF:', error.message);
    res.status(500).json({ error: 'Failed to fetch PDF' });
  }
}; 