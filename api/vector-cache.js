const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');
const fs = require('fs');
const path = require('path');

// Persistent cache directory for vector stores
const CACHE_DIR = '/tmp/vector_cache';
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory cache as fallback for Vercel
const memoryCache = new Map();

// Cache management functions
const saveVectorStore = async (filename, vectorStore) => {
  try {
    // Save to file cache
    const cacheFile = path.join(CACHE_DIR, `${filename}.json`);
    const documents = vectorStore.memoryVectors.map(v => ({
      pageContent: v.pageContent,
      metadata: v.metadata
    }));
    fs.writeFileSync(cacheFile, JSON.stringify(documents));
    console.log(`Vector store saved to file for ${filename}`);
    
    // Also save to memory cache as backup
    memoryCache.set(filename, vectorStore);
    console.log(`Vector store saved to memory cache for ${filename}`);
  } catch (error) {
    console.error('Error saving vector store:', error);
    // Fallback to memory cache only
    memoryCache.set(filename, vectorStore);
    console.log(`Vector store saved to memory cache only for ${filename}`);
  }
};

const loadVectorStore = async (filename, apiKey) => {
  try {
    // First try to load from memory cache
    if (memoryCache.has(filename)) {
      console.log(`Vector store loaded from memory cache for ${filename}`);
      return memoryCache.get(filename);
    }
    
    // Then try to load from file cache
    const cacheFile = path.join(CACHE_DIR, `${filename}.json`);
    if (fs.existsSync(cacheFile)) {
      const documentsData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const documents = documentsData.map(doc => new Document({
        pageContent: doc.pageContent,
        metadata: doc.metadata
      }));
      
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        batchSize: 50,
      });
      
      const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
      // Store in memory cache for future use
      memoryCache.set(filename, vectorStore);
      console.log(`Vector store loaded from file and cached in memory for ${filename}`);
      return vectorStore;
    }
    
    console.log(`No vector store found for ${filename}`);
    return null;
  } catch (error) {
    console.error('Error loading vector store:', error);
    return null;
  }
};

const getCacheInfo = () => {
  return {
    cacheDir: CACHE_DIR,
    cacheExists: fs.existsSync(CACHE_DIR),
    cacheFiles: fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR) : [],
    memoryCacheKeys: Array.from(memoryCache.keys())
  };
};

module.exports = {
  saveVectorStore,
  loadVectorStore,
  getCacheInfo
};
