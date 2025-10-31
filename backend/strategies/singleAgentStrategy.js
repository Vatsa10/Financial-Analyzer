/**
 * Single Agent RAG Strategy
 * Replicates the exact architecture from the current agentic workflow
 * but uses the existing agenticWorkflow.js implementation
 */

const {
  prepareDocuments,
  createVectorStore,
  generateSectionsWithAgents,
  answerQuestionWithAgents,
  conversationStore
} = require('../agenticWorkflow');

const SECTION_ORDER = ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'];

class SingleAgentStrategy {
  constructor() {
    this.name = 'Single Agent';
    this.description = 'Fast, unified analysis with consistent output';
  }

  getConversationKey(companyName) {
    return `single:${(companyName || 'unknown').toLowerCase()}`;
  }

  // Main execution method - uses exact same architecture as current implementation
  async execute({ extractedText, companyName, apiKey }) {
    console.log('[Single Agent] Starting analysis using agentic workflow...');
    
    try {
      const { documents } = await prepareDocuments(extractedText);
      const vectorStore = await createVectorStore(documents);

      const conversationKey = this.getConversationKey(companyName);
      const existingHistory = conversationStore.get(conversationKey) || [];

      const { sections, conversationHistory } = await generateSectionsWithAgents({
        sectionTypes: SECTION_ORDER,
        documents,
        vectorStore,
        companyName,
        apiKey,
        conversationHistory: existingHistory
      });

      conversationStore.set(conversationKey, conversationHistory);

      console.log('[Single Agent] Analysis completed');
      return { sections, vectorStore, mode: 'single' };
    } catch (error) {
      console.error('[Single Agent] Error in analysis:', error);
      throw error;
    }
  }

  // Answer questions using the exact same architecture
  async answerQuestion({ vectorStore, question, companyName, apiKey }) {
    console.log('[Single Agent] Answering question using agentic workflow...');
    
    try {
      const conversationKey = this.getConversationKey(companyName);
      const existingHistory = conversationStore.get(conversationKey) || [];

      const { answer, conversationHistory } = await answerQuestionWithAgents({
        vectorStore,
        question,
        companyName,
        apiKey,
        conversationHistory: existingHistory
      });

      conversationStore.set(conversationKey, conversationHistory);

      return answer;
    } catch (error) {
      console.error('[Single Agent] Error in Q&A:', error);
      throw error;
    }
  }
}

module.exports = SingleAgentStrategy;
