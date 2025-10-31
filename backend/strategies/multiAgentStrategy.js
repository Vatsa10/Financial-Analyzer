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

  // Agent-specific content generation with structured formatting
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
            content: `You are a ${agent.role} specializing in ${agent.expertise}. 
CRITICAL FORMATTING RULES:
- Output MUST be plain text bullet points using the • symbol ONLY
- Each bullet point must start with • followed by a space
- Each point must be on a separate line
- Do NOT use markdown formatting (no **, __, ##, etc.)
- Do NOT use numbered lists or dashes
- Do NOT use headers or sections
- Each bullet should be a complete, informative sentence`
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
    
    // Format and clean the output
    return this.formatOutput(content);
  }

  // Format output to ensure consistent bullet point structure
  formatOutput(content) {
    // Split into lines and clean
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    
    // Process each line to ensure proper bullet formatting
    const formatted = lines.map(line => {
      // Remove markdown formatting
      line = line.replace(/[*_#`]/g, '');
      
      // Convert various bullet styles to •
      line = line.replace(/^[-•*]\s*/, '');
      line = line.replace(/^\d+\.\s*/, '');
      
      // Ensure it starts with bullet
      if (!line.startsWith('•')) {
        line = `• ${line}`;
      } else {
        line = `• ${line.replace(/^•\s*/, '')}`;
      }
      
      return line;
    });
    
    // Remove duplicates and return
    const unique = Array.from(new Set(formatted));
    return unique.join('\n');
  }

  // Generate overview using researcher agent
  async generateOverview(relevantChunks, companyName, apiKey) {
    const prompt = `Analyze the following information about ${companyName} and provide a comprehensive company overview.

Relevant Information:
${relevantChunks.join('\n\n')}

Create 5-7 bullet points covering:
- Business model and core operations
- Market position and competitive landscape
- Strategic initiatives and recent developments
- Geographic presence and key markets
- Organizational structure and key leadership

Each bullet point must be a complete, informative sentence with specific details from the document.`;

    return await this.generateWithAgent('researcher', prompt, apiKey);
  }

  // Generate financial highlights using analyst agent
  async generateFinancialHighlights(relevantChunks, companyName, apiKey) {
    const prompt = `Analyze the financial performance of ${companyName} based on the following information.

Relevant Information:
${relevantChunks.join('\n\n')}

Create 6-8 bullet points covering:
- Revenue trends and growth rates with specific numbers
- Profitability metrics (margins, EBITDA, net income) with percentages
- Key financial ratios and their implications
- Cash flow analysis and liquidity position
- Year-over-year and quarter-over-quarter comparisons
- Balance sheet strength indicators

Each bullet must include specific numbers, percentages, or metrics from the document.`;

    return await this.generateWithAgent('analyst', prompt, apiKey);
  }

  // Generate risk assessment using risk assessor agent
  async generateRiskAssessment(relevantChunks, companyName, apiKey) {
    const prompt = `Identify and evaluate key risks for ${companyName} based on the following information.

Relevant Information:
${relevantChunks.join('\n\n')}

Create 5-7 bullet points covering:
- Business and operational risks
- Financial risks (debt, liquidity, currency exposure)
- Market and competitive risks
- Regulatory and compliance risks
- Strategic and execution risks
- External factors (economic, geopolitical)

Each bullet must describe a specific risk and its potential impact on the company.`;

    return await this.generateWithAgent('riskAssessor', prompt, apiKey);
  }

  // Generate management commentary using strategist agent
  async generateManagementCommentary(relevantChunks, companyName, apiKey) {
    const prompt = `Interpret management's perspective and forward-looking statements for ${companyName} based on the following information.

Relevant Information:
${relevantChunks.join('\n\n')}

Create 5-7 bullet points covering:
- Executive commentary on performance and outlook
- Strategic priorities and key initiatives
- Forward-looking statements and guidance
- Management's view on challenges and opportunities
- Capital allocation strategy and investment plans
- Long-term vision and growth goals

Each bullet must capture specific management statements or strategic directions from the document.`;

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
    
    const prompt = `Answer this question about ${companyName} based on the following information.

Question: ${question}

Relevant Information:
${relevantChunks.join('\n\n')}

Provide a concise answer (2-3 sentences) that:
- Directly addresses the question with specific information
- Cites relevant data or facts from the document
- Acknowledges if information is limited or unavailable

Use plain text only, no formatting.`;

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
            content: 'You are a Financial Analysis Coordinator. Provide concise, evidence-based answers using plain text only. No markdown formatting.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    let answer = data.choices[0]?.message?.content || 'Unable to answer the question.';
    
    // Clean up any markdown formatting
    answer = answer.replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();
    
    return answer;
  }
}

module.exports = MultiAgentStrategy;
