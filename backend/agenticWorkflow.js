const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { HuggingFaceInferenceEmbeddings } = require('@langchain/community/embeddings/hf');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');

const SECTION_GUIDANCE = {
  overview: `You are an expert financial analyst. Provide a concise overview of the company's business model and strategic positioning.
- Focus on core operations, strategic priorities, and competitive advantages.
- Exclude specific financial numbers or third-party opinions.
- Output MUST be plain text bullet points using the • symbol, with each point on a separate line.
- Do NOT use markdown formatting like headers or bold text.`,
  financialHighlights: `You are analyzing recent financial performance.
- Highlight the most important financial metrics and trends (revenue, profit, margins, operational metrics).
- Each bullet should be a full sentence describing the trend, including specific numbers when available.
- Output MUST be plain text bullet points using the • symbol, with each point on a separate line.
- Do NOT combine multiple facts in one bullet. No markdown formatting.`,
  keyRisks: `You are identifying key risks that could affect the company.
- Group risks logically (market, operational, financial, regulatory) when possible.
- Summaries should explain the potential negative impact in one sentence.
- Exclude mitigation strategies or management plans.
- Output MUST be plain text bullet points using the • symbol, with each point on a separate line.
- Do NOT use markdown formatting.`,
  managementCommentary: `You are summarizing management's forward-looking perspective.
- Focus on growth initiatives, strategic plans, market outlook, and future priorities.
- Exclude financial results, historic metrics, or risk duplication.
- Output MUST be plain text bullet points using the • symbol, with each point on a separate line.
- Do NOT use markdown formatting.`
};

const conversationStore = new Map();

const cleanText = (text) => {
  return text
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
    .replace(/^\s*[A-Z\s]+\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
};

const splitTextIntoSemanticChunks = async (text) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 150,
  });
  const chunks = await splitter.splitText(text);
  return chunks.map((chunk, index) => new Document({
    pageContent: chunk,
    metadata: { id: `chunk_${index}` }
  }));
};

const prepareDocuments = async (rawText) => {
  const cleanedText = cleanText(rawText);
  const documents = await splitTextIntoSemanticChunks(cleanedText);
  return { cleanedText, documents };
};

const createVectorStore = async (documents) => {
  const embeddings = new HuggingFaceInferenceEmbeddings({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    apiKey: process.env.HF_API_KEY,
    apiUrl: 'https://api-inference.huggingface.co/pipeline/feature-extraction',
    maxRetries: 3
  });
  const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  return vectorStore;
};

const limitText = (text, maxLength = 4000) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

const formatConversationForPrompt = (history = []) => {
  if (!history.length) {
    return 'No prior context available.';
  }
  const recent = history.slice(-8);
  return recent
    .map(entry => {
      const label = entry.agent ? `[${entry.agent.toUpperCase()}]` : '[CONTEXT]';
      return `${label} ${limitText(entry.content, 500)}`;
    })
    .join('\n');
};

const pushConversation = (history, agent, content) => {
  const cloned = history.slice();
  cloned.push({
    agent,
    content: limitText(content, 1200),
    timestamp: new Date().toISOString()
  });
  if (cloned.length > 24) {
    cloned.splice(0, cloned.length - 24);
  }
  return cloned;
};

const callLLM = async ({ messages, apiKey, maxTokens = 400, temperature = 0.2 }) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://your-website-url.com',
      'X-Title': 'Financial LLM Analyzer'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4-turbo-preview',
      messages,
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
};

const ensureJSON = (text) => {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON braces detected');
    const jsonString = text.slice(start, end + 1);
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
};

const plannerAgent = async ({
  mode,
  sectionType,
  companyName,
  question,
  conversationHistory,
  apiKey
}) => {
  const systemPrompt = `You are the PLANNER agent coordinating an agentic retrieval-augmented generation workflow for financial analysis.
You must reason step-by-step and respond ONLY with strict JSON describing the plan.
`;

  const responsibilities = mode === 'report'
    ? `Task: Develop a retrieval and analysis plan for the "${sectionType}" section about ${companyName}.
Focus on tailored search queries, sub-questions, and data requirements specific to that section.`
    : `Task: Develop a retrieval and analysis plan to answer the question about ${companyName}: "${question}".
Determine necessary sub-questions, retrieval strategies, and validation needs.`;

  const conversationContext = formatConversationForPrompt(conversationHistory);

  const userPrompt = `${responsibilities}

Previous context:
${conversationContext}

Return JSON with this schema:
{
  "objective": string,
  "retrievalQueries": string[],
  "fallbackQueries": string[],
  "analysisFocus": string[],
  "subQuestions": string[],
  "toolSuggestions": string[]
}
Make retrieval queries diverse (semantic, keyword, time-focused).
`;

  const content = await callLLM({
    apiKey,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 320,
    temperature: 0.2
  });

  const plan = ensureJSON(content);

  if (!plan) {
    const defaultPlan = {
      objective: mode === 'report'
        ? `Summarize ${sectionType} insights for ${companyName}`
        : `Answer the question using primary facts from ${companyName}'s financial document`,
      retrievalQueries: mode === 'report'
        ? [
            `${companyName} ${sectionType} section core themes`,
            `${companyName} ${sectionType} highlights recent`
          ]
        : [question, `${companyName} ${question}`],
      fallbackQueries: mode === 'report'
        ? [`${companyName} ${sectionType} risks`, `${companyName} ${sectionType} forward guidance`]
        : [`${companyName} details ${question}`, `${companyName} discussion ${question}`],
      analysisFocus: mode === 'report'
        ? [`Key talking points for ${sectionType}`]
        : ['Provide direct answer grounded in evidence'],
      subQuestions: mode === 'report' ? [] : [question],
      toolSuggestions: ['numeric_summary', 'keyword_coverage']
    };
    return { plan: defaultPlan, raw: content || '' };
  }

  return { plan, raw: content };
};

const lexicalScore = (text, keywords) => {
  const lower = text.toLowerCase();
  return keywords.reduce((score, keyword) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return score;
    const regex = new RegExp(trimmed.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
    const matches = lower.match(regex);
    return score + (matches ? matches.length : 0);
  }, 0);
};

const lexicalSearch = (documents, queries, limit = 4) => {
  if (!documents?.length || !queries?.length) return [];
  const keywords = queries.flatMap(q => q.split(/[,;\-]/));
  const scored = documents.map(doc => ({
    doc,
    score: lexicalScore(doc.pageContent, keywords)
  }));
  return scored
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.doc);
};

const dedupeByContent = (docs) => {
  const seen = new Set();
  const result = [];
  docs.forEach(doc => {
    const signature = doc.pageContent.slice(0, 160);
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(doc);
    }
  });
  return result;
};

const researcherAgent = async ({ plan, vectorStore, documents }) => {
  const { retrievalQueries = [], fallbackQueries = [] } = plan;
  const queries = retrievalQueries.filter(Boolean);

  const vectorResults = [];
  for (const query of queries) {
    const matches = await vectorStore.similaritySearch(query, 4);
    vectorResults.push(...matches.map(match => match));
  }

  const lexicalResults = lexicalSearch(documents, queries, 4);
  let combined = dedupeByContent([...vectorResults, ...lexicalResults]);

  if (combined.length < 3 && fallbackQueries.length) {
    for (const query of fallbackQueries) {
      const matches = await vectorStore.similaritySearch(query, 3);
      combined.push(...matches.map(match => match));
    }
    const lexicalFallback = lexicalSearch(documents, fallbackQueries, 3);
    combined.push(...lexicalFallback);
    combined = dedupeByContent(combined);
  }

  const snippets = combined.slice(0, 8).map(doc => doc.pageContent.trim());
  const aggregatedText = snippets.join('\n---\n');
  return {
    snippets,
    aggregatedText,
    coverageScore: snippets.length
  };
};

const toolkit = {
  numeric_summary: (snippets) => {
    const lines = [];
    snippets.forEach(snippet => {
      snippet.split(/\n+/).forEach(line => {
        if (/\d/.test(line)) {
          lines.push(line.trim());
        }
      });
    });
    const unique = Array.from(new Set(lines)).slice(0, 6);
    return unique.length
      ? `Numeric highlights identified:\n${unique.join('\n')}`
      : 'No explicit numeric highlights detected in retrieved context.';
  },
  keyword_coverage: (snippets, plan) => {
    const focusTerms = (plan.analysisFocus || []).join(' ').toLowerCase().split(/\s+/).filter(Boolean);
    if (!focusTerms.length) {
      return 'No focus keywords provided by plan.';
    }
    const text = snippets.join(' ').toLowerCase();
    const coverage = focusTerms.reduce((acc, term) => {
      acc[term] = (text.match(new RegExp(term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
      return acc;
    }, {});
    return `Keyword coverage counts: ${JSON.stringify(coverage)}`;
  }
};

const applyTools = (snippets, plan) => {
  const suggestions = plan.toolSuggestions || [];
  const outputs = [];
  suggestions.forEach(toolName => {
    const tool = toolkit[toolName];
    if (tool) {
      const result = tool(snippets, plan);
      outputs.push({ tool: toolName, result });
    }
  });
  return outputs;
};

const analystAgent = async ({
  mode,
  sectionType,
  companyName,
  plan,
  retrieved,
  question,
  apiKey,
  toolOutputs
}) => {
  const systemPrompt = mode === 'report'
    ? 'You are the ANALYST agent synthesizing financial document insights into bullet points.'
    : 'You are the ANALYST agent answering financial questions concisely with evidence-backed statements.';

  const guidance = mode === 'report'
    ? SECTION_GUIDANCE[sectionType]
    : `Provide a precise answer (2-3 sentences) to the user question using only the retrieved evidence. Mention if information is unavailable.`;

  const planSummary = JSON.stringify({
    objective: plan.objective,
    subQuestions: plan.subQuestions,
    analysisFocus: plan.analysisFocus
  });

  const toolSummary = toolOutputs.length
    ? toolOutputs.map(t => `Tool[${t.tool}]: ${t.result}`).join('\n')
    : 'No tool outputs available.';

  const userPrompt = `Company: ${companyName}
Mode: ${mode}
Section: ${sectionType || 'N/A'}
Question: ${question || 'N/A'}
Plan Summary: ${planSummary}
Guidance: ${guidance}

Tool Outputs:
${toolSummary}

Retrieved Evidence:
${limitText(retrieved.aggregatedText, 6000)}

Produce the required response now.`;

  const content = await callLLM({
    apiKey,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: mode === 'report' ? 520 : 220,
    temperature: 0.2
  });

  return content;
};

const validatorAgent = async ({
  mode,
  sectionType,
  content,
  plan,
  retrieved,
  apiKey
}) => {
  const issues = [];
  if (!content?.trim()) {
    issues.push('Empty content generated.');
  }

  if (mode === 'report') {
    const lines = content.split('\n').filter(line => line.trim());
    const bulletViolation = lines.some(line => !line.trim().startsWith('• '));
    if (bulletViolation) {
      issues.push('All lines must begin with "• " bullet.');
    }
    const markdownDetected = /[*#_`]/.test(content.replace(/•/g, ''));
    if (markdownDetected) {
      issues.push('Content must not use markdown formatting.');
    }
  } else {
    const sentences = content.replace(/\s+/g, ' ').split(/[.!?]+/).filter(Boolean);
    if (sentences.length < 1 || sentences.length > 4) {
      issues.push('Answer must be concise (2-3 sentences ideally).');
    }
  }

  if (!issues.length) {
    return { content, issues };
  }

  const systemPrompt = 'You are the VALIDATOR agent correcting outputs to match formatting and quality requirements.';
  const userPrompt = `Issues detected: ${issues.join(' | ')}
Mode: ${mode}
Section: ${sectionType || 'N/A'}
Plan Objective: ${plan.objective}

Original Content:
${content}

Retrieved Evidence (for reference):
${limitText(retrieved.aggregatedText, 4000)}

Return a corrected version that resolves all issues.`;

  const corrected = await callLLM({
    apiKey,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: mode === 'report' ? 520 : 220,
    temperature: 0.1
  });

  return { content: corrected, issues };
};

const formatterAgent = ({ mode, content }) => {
  if (mode === 'report') {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => (line.startsWith('•') ? `• ${line.replace(/^•\s*/, '')}` : `• ${line}`));
    const unique = Array.from(new Set(lines));
    return unique.join('\n');
  }

  return content.replace(/\s+/g, ' ').trim();
};

const getDocumentsFromVectorStore = (vectorStore) => {
  const memoryVectors = vectorStore?.memoryVectors || [];
  const docs = memoryVectors
    .map(entry => entry.document)
    .filter(Boolean);
  return docs;
};

const runAgenticSectionPipeline = async ({
  sectionType,
  companyName,
  vectorStore,
  documents,
  conversationHistory,
  apiKey
}) => {
  const planner = await plannerAgent({
    mode: 'report',
    sectionType,
    companyName,
    conversationHistory,
    apiKey
  });

  let history = pushConversation(conversationHistory, 'planner', planner.raw || JSON.stringify(planner.plan));

  const retrieved = await researcherAgent({
    plan: planner.plan,
    vectorStore,
    documents
  });
  history = pushConversation(history, 'researcher', `Retrieved ${retrieved.snippets.length} snippets.`);

  const toolOutputs = applyTools(retrieved.snippets, planner.plan);
  if (toolOutputs.length) {
    toolOutputs.forEach(tool => {
      history = pushConversation(history, `tool:${tool.tool}`, tool.result);
    });
  }

  const analystContent = await analystAgent({
    mode: 'report',
    sectionType,
    companyName,
    plan: planner.plan,
    retrieved,
    apiKey,
    toolOutputs
  });
  history = pushConversation(history, 'analyst', analystContent);

  const validated = await validatorAgent({
    mode: 'report',
    sectionType,
    content: analystContent,
    plan: planner.plan,
    retrieved,
    apiKey
  });
  history = pushConversation(history, 'validator', validated.content);

  const formatted = formatterAgent({ mode: 'report', content: validated.content });
  history = pushConversation(history, 'formatter', formatted);

  return { content: formatted, conversationHistory: history };
};

const runAgenticQuestionPipeline = async ({
  vectorStore,
  question,
  companyName,
  conversationHistory,
  apiKey
}) => {
  const documents = getDocumentsFromVectorStore(vectorStore);

  const planner = await plannerAgent({
    mode: 'question',
    companyName,
    question,
    conversationHistory,
    apiKey
  });

  let history = pushConversation(conversationHistory, 'planner', planner.raw || JSON.stringify(planner.plan));

  const retrieved = await researcherAgent({
    plan: planner.plan,
    vectorStore,
    documents
  });
  history = pushConversation(history, 'researcher', `Retrieved ${retrieved.snippets.length} snippets for question.`);

  const toolOutputs = applyTools(retrieved.snippets, planner.plan);
  if (toolOutputs.length) {
    toolOutputs.forEach(tool => {
      history = pushConversation(history, `tool:${tool.tool}`, tool.result);
    });
  }

  const analystContent = await analystAgent({
    mode: 'question',
    companyName,
    plan: planner.plan,
    retrieved,
    question,
    apiKey,
    toolOutputs
  });
  history = pushConversation(history, 'analyst', analystContent);

  const validated = await validatorAgent({
    mode: 'question',
    content: analystContent,
    plan: planner.plan,
    retrieved,
    apiKey
  });
  history = pushConversation(history, 'validator', validated.content);

  const formatted = formatterAgent({ mode: 'question', content: validated.content });
  history = pushConversation(history, 'formatter', formatted);

  return { answer: formatted, conversationHistory: history };
};

const generateSectionsWithAgents = async ({
  sectionTypes,
  documents,
  vectorStore,
  companyName,
  apiKey,
  conversationHistory = []
}) => {
  const sections = {};
  let history = conversationHistory.slice();

  for (const sectionType of sectionTypes) {
    const result = await runAgenticSectionPipeline({
      sectionType,
      companyName,
      vectorStore,
      documents,
      conversationHistory: history,
      apiKey
    });
    sections[sectionType] = result.content;
    history = result.conversationHistory;
  }

  return { sections, conversationHistory: history };
};

const answerQuestionWithAgents = async ({
  vectorStore,
  question,
  companyName,
  apiKey,
  conversationHistory = []
}) => {
  const result = await runAgenticQuestionPipeline({
    vectorStore,
    question,
    companyName,
    conversationHistory,
    apiKey
  });
  return result;
};

module.exports = {
  SECTION_GUIDANCE,
  conversationStore,
  prepareDocuments,
  createVectorStore,
  generateSectionsWithAgents,
  answerQuestionWithAgents
};
