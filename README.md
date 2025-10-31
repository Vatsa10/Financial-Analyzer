# Financial Analyzer

**Universal Financial Document Intelligence Platform**

Transform any financial document into actionable intelligence using advanced LLM technology with RAG (Retrieval-Augmented Generation). Analyze quarterly reports, SEC filings, 10-K/10-Q forms, earnings transcripts, and annual reports from companies worldwide.

## Features

### **Dual-Mode Analysis System**
- **Single Agent Mode**: Fast, unified analysis with structured bullet-point output - ideal for quick insights
- **Multi-Agent Mode**: Specialized agents (Researcher, Analyst, Risk Assessor, Strategist) for deeper analysis with structured formatting
- **Consistent Output**: Both modes produce clean, structured bullet points with no markdown formatting
- **Intelligent Fallback**: Automatic fallback to Single Agent if Multi-Agent encounters issues
- **Mode Persistence**: Your preferred mode is saved automatically

### **Universal Document Processing**
- **Multi-Format Support**: Quarterly reports, SEC filings, 10-K/10-Q forms, earnings transcripts
- **Global Coverage**: Analyze financial documents from companies worldwide
- **Smart Chunking**: Memory-optimized handling for large regulatory filings

### **LLM-Powered Analysis**
- **Advanced RAG**: Context-aware information retrieval with vector embeddings
- **Structured Output**: Automated formatting ensures consistent bullet-point structure across all sections
- **Multi-Agent Pipeline**: Planner → Researcher → Analyst → Validator → Formatter workflow (Single Agent mode)
- **Specialized Agents**: Role-based agents with expertise-specific analysis (Multi-Agent mode)
- **Parallel Processing**: Simultaneous analysis of multiple report sections
- **Error Resilience**: Automatic retry logic with intelligent rate limiting
- **Strategy Pattern**: Modular architecture supporting multiple analysis approaches

### **Generated Analysis Sections**
All sections are generated with structured bullet points (•) for easy readability:
- **Company Overview**: Business model, operations, market position, and strategic initiatives
- **Financial Highlights**: Revenue trends, profitability metrics, ratios, and performance indicators with specific numbers
- **Risk Assessment**: Business, operational, financial, regulatory, and market risks with impact analysis
- **Management Commentary**: Executive outlook, strategic priorities, forward guidance, and long-term vision

### **Interactive Q&A**
- **Intelligent Chat**: Ask questions about the analyzed document
- **Context-Aware Responses**: Answers based on actual document content
- **Semantic Search**: Advanced retrieval for precise information

## Technology Stack

### Frontend
- **React 18.3.1** with TypeScript 5.5.3
- **Vite 5.4.1** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern UI component library

### Backend
- **Node.js/Express** - REST API backend
- **OpenRouter** - Access to multiple LLM providers including GPT-4 Turbo
- **HuggingFace** - Embeddings for semantic search
- **Vector Store** - In-memory semantic search with HuggingFace embeddings

## Running the Application

1. Install dependencies for both frontend and backend:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

2. Start the backend server:

```bash
cd backend
npm run dev
```

The server will start on `http://localhost:3001`

3. Start the frontend development server:

```bash
cd frontend
npm run dev
```

Access the application at `http://localhost:5173`

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
# Required for OpenRouter (LLM API access)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: HuggingFace API key for faster embeddings (fallback to local model if not provided)
HF_API_KEY=your_huggingface_api_key_here
```

### Getting API Keys

1. **OpenRouter API Key**:
   - Sign up at [OpenRouter](https://openrouter.ai/)
   - Get your API key from the [keys page](https://openrouter.ai/keys)
   - Add funds to your account (required for API usage)

2. **HuggingFace API Key (Optional)**:
   - Sign up at [HuggingFace](https://huggingface.co/)
   - Get your API key from [settings](https://huggingface.co/settings/tokens)
   - The app will work without this, but with slower local embeddings

## Project Structure

### Frontend
```
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   ├── ChatInterface.tsx
│   ├── FileUpload.tsx
│   ├── ReportGenerator.tsx
│   └── ReportDisplay.tsx
├── hooks/               # Custom React hooks
├── pages/               # Application pages
└── lib/                 # Utility libraries
```

### Backend
```
backend/
├── server.js                      # Express server & API endpoints
├── ragOrchestrator.js             # Strategy pattern orchestrator
├── agenticWorkflow.js             # Agentic pipeline with structured formatting
├── strategies/
│   ├── singleAgentStrategy.js    # Single agent with planner-researcher-analyst-validator-formatter pipeline
│   └── multiAgentStrategy.js     # Multi-agent with specialized roles and structured output
├── pdfProcessor.js                # PDF text extraction
├── package.json                   # Dependencies
└── uploads/                       # Temporary file storage
```

## API Endpoints

### Document Processing
- `POST /api/upload` - Upload financial document (PDF)
- `POST /api/generate-report` - Generate comprehensive financial analysis (supports `mode` parameter: `single` or `multi`)
- `GET /api/fetch-pdf` - Fetch PDF documents from external URLs

### Interactive Analysis
- `POST /api/ask-question` - Ask questions about analyzed documents (uses same mode as report generation)
- `GET /api/rag-modes` - Get available analysis modes and their status
- `GET /api/health` - Check API health and environment status

## Supported Documents

- **Quarterly Reports** (10-Q, Q1/Q2/Q3/Q4)
- **Annual Reports** (10-K, Annual Filings)
- **SEC Filings** (8-K, Proxy Statements)
- **Earnings Materials** (Call Transcripts, Presentations)
- **Credit Reports** (Rating Agency Reports)

---

**Financial Analyzer** - Transform financial documents into actionable intelligence with LLM precision.
