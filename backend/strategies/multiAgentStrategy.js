/**
 * Multi-Agent RAG Strategy
 * Uses specialized agents for different analysis tasks
 */

const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HuggingFaceInferenceEmbeddings } = require('@langchain/community/embeddings/hf');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');

class MultiAgentStrategy {
  constructor() {
    this.name = 'Multi-Agent';
    this.description = 'Specialized agents for deeper, more nuanced analysis';
    
    // Define specialized agents
    this.agents = {
      researcher: {
        role: 'Financial Researcher',
        expertise: 'Extracting and organizing financial data',
        temperature: 0.1
      },
      analyst: {
        role: 'Financial Analyst',
        expertise: 'Analyzing trends and metrics',
        temperature: 0.2
      },
      riskAssessor: {
        role: 'Risk Assessment Specialist',
        expertise: 'Identifying and evaluating risks',
        temperature: 0.15
      },
      strategist: {
        role: 'Strategic Advisor',
        expertise: 'Interpreting management strategy and outlook',
        temperature: 0.2
      }
    };
  }

  cleanText(text) {
    return text
      .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
      .replace(/^\s*[A-Z\s]+\s*$/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  async splitTextIntoSemanticChunks(text) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500, // Larger chunks for multi-agent
      chunkOverlap: 200,
    });
    const chunks = await splitter.splitText(text);
    return chunks.map((chunk, index) => new Document({
      pageContent: chunk,
      metadata: { id: `chunk_${index}` }
    }));
  }

  async createVectorStore(documents) {
    const embeddings = new HuggingFaceInferenceEmbeddings({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      apiKey: process.env.HF_API_KEY,
      apiUrl: 'https://api-inference.huggingface.co/pipeline/feature-extraction',
      maxRetries: 3
    });
    const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
    return vectorStore;
  }

  async queryRelevantChunks(vectorStore, query, limit = 5) {
    const results = await vectorStore.similaritySearch(query, limit);
    return results.map(doc => doc.pageContent);
  }

  // Agent-specific content generation
  async generateWithAgent(agentType, prompt, apiKey) {
    const agent = this.agents[agentType];
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://financial-analyzer.com',
        'X-Title': `Financial Analyzer - Multi-Agent: ${agent.role}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a ${agent.role} specializing in ${agent.expertise}. Provide detailed, professional analysis. Use plain text with bullet points (•) for lists.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: agent.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content || 'Analysis not available';
    content = content.replace(/^-\s+/gm, '• ');
    return content;
  }

  // Generate overview using researcher agent
  async generateOverview(relevantChunks, companyName, apiKey) {
    const prompt = `As a Financial Researcher, provide a comprehensive company overview for ${companyName}:

Relevant Information:
${relevantChunks.join('\n\n')}

Include:
• Business model and core operations
• Market position and competitive landscape
• Strategic initiatives and recent developments
• Geographic presence and key markets
• Organizational structure and key leadership`;

    return await this.generateWithAgent('researcher', prompt, apiKey);
  }

  // Generate financial highlights using analyst agent
  async generateFinancialHighlights(relevantChunks, companyName, apiKey) {
    const prompt = `As a Financial Analyst, analyze the financial performance of ${companyName}:

Relevant Information:
${relevantChunks.join('\n\n')}

Provide detailed analysis of:
• Revenue trends and growth rates
• Profitability metrics (margins, EBITDA, net income)
• Key financial ratios and their implications
• Cash flow analysis and liquidity position
• Year-over-year and quarter-over-quarter comparisons
• Balance sheet strength`;

    return await this.generateWithAgent('analyst', prompt, apiKey);
  }

  // Generate risk assessment using risk assessor agent
  async generateRiskAssessment(relevantChunks, companyName, apiKey) {
    const prompt = `As a Risk Assessment Specialist, identify and evaluate risks for ${companyName}:

Relevant Information:
${relevantChunks.join('\n\n')}

Analyze:
• Business and operational risks
• Financial risks (debt, liquidity, currency)
• Market and competitive risks
• Regulatory and compliance risks
• Strategic and execution risks
• External factors (economic, geopolitical)`;

    return await this.generateWithAgent('riskAssessor', prompt, apiKey);
  }

  // Generate management commentary using strategist agent
  async generateManagementCommentary(relevantChunks, companyName, apiKey) {
    const prompt = `As a Strategic Advisor, interpret management's perspective for ${companyName}:

Relevant Information:
${relevantChunks.join('\n\n')}

Summarize:
• Executive commentary on performance
• Strategic priorities and initiatives
• Forward-looking statements and guidance
• Management's view on challenges and opportunities
• Capital allocation strategy
• Long-term vision and goals`;

    return await this.generateWithAgent('strategist', prompt, apiKey);
  }

  // Main execution method
  async execute({ extractedText, companyName, apiKey }) {
    console.log('[Multi-Agent] Starting analysis with specialized agents...');
    
    const cleanedText = this.cleanText(extractedText);
    const documents = await this.splitTextIntoSemanticChunks(cleanedText);
    const vectorStore = await this.createVectorStore(documents);

    // Define queries for each agent
    const queries = {
      overview: `${companyName} business model operations strategy company information`,
      financialHighlights: `${companyName} revenue profit financial performance metrics ratios`,
      keyRisks: `${companyName} risks challenges threats concerns issues problems`,
      managementCommentary: `${companyName} management outlook guidance strategy future plans vision`
    };

    // Retrieve relevant chunks for each section
    const [overviewChunks, financialChunks, riskChunks, managementChunks] = await Promise.all([
      this.queryRelevantChunks(vectorStore, queries.overview, 5),
      this.queryRelevantChunks(vectorStore, queries.financialHighlights, 5),
      this.queryRelevantChunks(vectorStore, queries.keyRisks, 5),
      this.queryRelevantChunks(vectorStore, queries.managementCommentary, 5)
    ]);

    // Generate content using specialized agents
    console.log('[Multi-Agent] Deploying specialized agents...');
    const [overview, financialHighlights, keyRisks, managementCommentary] = await Promise.all([
      this.generateOverview(overviewChunks, companyName, apiKey),
      this.generateFinancialHighlights(financialChunks, companyName, apiKey),
      this.generateRiskAssessment(riskChunks, companyName, apiKey),
      this.generateManagementCommentary(managementChunks, companyName, apiKey)
    ]);

    console.log('[Multi-Agent] All agents completed their analysis');
    
    return {
      sections: {
        overview,
        financialHighlights,
        keyRisks,
        managementCommentary
      },
      vectorStore,
      mode: 'multi'
    };
  }

  // Answer questions using coordinator agent
  async answerQuestion({ vectorStore, question, companyName, apiKey }) {
    const relevantChunks = await this.queryRelevantChunks(vectorStore, question, 4);
    
    const prompt = `As a Financial Analysis Coordinator, answer this question about ${companyName}:

Question: ${question}

Relevant Information:
${relevantChunks.join('\n\n')}

Provide a comprehensive, well-reasoned answer that:
• Directly addresses the question
• Cites specific information from the document
• Provides context and implications
• Acknowledges any limitations in the available data`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://financial-analyzer.com',
        'X-Title': 'Financial Analyzer - Multi-Agent Q&A'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a Financial Analysis Coordinator who synthesizes insights from multiple specialized agents.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.25,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Unable to answer the question.';
  }
}

module.exports = MultiAgentStrategy;
