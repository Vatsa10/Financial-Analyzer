const {
  prepareDocuments,
  createVectorStore,
  generateSectionsWithAgents,
  answerQuestionWithAgents,
  conversationStore
} = require('./agenticWorkflow');

const SECTION_ORDER = ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'];

const getConversationKey = (companyName) => {
  return `company:${(companyName || 'unknown').toLowerCase()}`;
};

const generateReportSections = async (extractedText, companyName, apiKey) => {
  try {
    const { documents } = await prepareDocuments(extractedText);
    const vectorStore = await createVectorStore(documents);

    const conversationKey = getConversationKey(companyName);
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

    return { sections, vectorStore };
  } catch (error) {
    console.error('Error in financial document analysis:', error);
    throw error;
  }
};

const answerQuestion = async (vectorStore, question, companyName, apiKey) => {
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

    return answer;
  } catch (error) {
    console.error('Error in Q&A processing:', error);
    throw error;
  }
};

module.exports = { generateReportSections, answerQuestion };