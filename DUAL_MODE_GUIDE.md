# Dual-Mode Analysis System Guide

## Overview

The Financial Analyzer now supports two distinct analysis modes, each optimized for different use cases:

### Single Agent Mode
- **Best for**: Quick insights, consistent formatting, cost-effective analysis
- **Processing time**: Faster (~30-60 seconds)
- **Approach**: Unified LLM analysis with one call per section
- **Cost**: Lower API usage
- **Output**: Consistent, well-structured reports

### Multi-Agent Mode
- **Best for**: Comprehensive analysis, specialized insights, detailed reports
- **Processing time**: Slower (~60-120 seconds)
- **Approach**: Specialized agents for each section (Researcher, Analyst, Risk Assessor, Strategist)
- **Cost**: Higher API usage (4 specialized agents)
- **Output**: More nuanced, detailed analysis with specialized expertise

## Architecture

### Strategy Pattern Implementation

```
RAGOrchestrator
├── SingleAgentStrategy
│   ├── Unified analysis approach
│   ├── Consistent formatting
│   └── Fast processing
└── MultiAgentStrategy
    ├── Researcher Agent (Company Overview)
    ├── Analyst Agent (Financial Highlights)
    ├── Risk Assessor Agent (Key Risks)
    └── Strategist Agent (Management Commentary)
```

### Key Components

1. **RAGOrchestrator** (`backend/ragOrchestrator.js`)
   - Manages strategy selection
   - Handles fallback logic
   - Validates mode availability
   - Tracks usage metadata

2. **SingleAgentStrategy** (`backend/strategies/singleAgentStrategy.js`)
   - Fast, unified analysis
   - Temperature: 0.1 (consistent output)
   - Chunk size: 1200 tokens
   - Retrieval limit: 4 chunks per section

3. **MultiAgentStrategy** (`backend/strategies/multiAgentStrategy.js`)
   - Specialized agent per section
   - Variable temperatures (0.1-0.2)
   - Chunk size: 1500 tokens
   - Retrieval limit: 5 chunks per section

## Usage

### Frontend

Users can select their preferred mode through the Mode Selector component:

```typescript
<ModeSelector 
  selectedMode={selectedMode}
  onModeChange={handleModeChange}
  disabled={isProcessing}
/>
```

The selection is automatically saved to localStorage and persists across sessions.

### Backend API

#### Generate Report with Mode Selection

```javascript
POST /api/generate-report
{
  "filename": "report.pdf",
  "companyName": "Apple Inc.",
  "mode": "single" // or "multi"
}
```

Response includes metadata:
```javascript
{
  "overview": "...",
  "financialHighlights": "...",
  "keyRisks": "...",
  "managementCommentary": "...",
  "metadata": {
    "mode": "single",
    "strategyName": "Single Agent",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "fallback": false
  }
}
```

#### Q&A with Mode Consistency

Questions are answered using the same mode that generated the report:

```javascript
POST /api/ask-question
{
  "filename": "cached-filename",
  "question": "What are the main revenue drivers?",
  "companyName": "Apple Inc."
}
```

## Configuration

### Environment Variables

```bash
# Default mode when none specified
DEFAULT_RAG_MODE=single

# Comma-separated list of enabled modes
ENABLED_RAG_MODES=single,multi

# API Keys
OPENROUTER_API_KEY=your_key_here
HF_API_KEY=your_key_here
```

### Feature Flags

You can disable modes by updating `ENABLED_RAG_MODES`:

```bash
# Only single agent mode
ENABLED_RAG_MODES=single

# Only multi-agent mode
ENABLED_RAG_MODES=multi

# Both modes (default)
ENABLED_RAG_MODES=single,multi
```

## Fallback Mechanism

If Multi-Agent mode fails, the system automatically falls back to Single Agent mode:

```javascript
{
  "metadata": {
    "mode": "single",
    "strategyName": "Single Agent",
    "fallback": true,
    "originalMode": "multi",
    "fallbackReason": "API request failed with status 429"
  }
}
```

Users are notified via toast message when fallback occurs.

## Performance Comparison

| Metric | Single Agent | Multi-Agent |
|--------|-------------|-------------|
| Processing Time | 30-60s | 60-120s |
| API Calls | 4 | 4 |
| Tokens per Call | ~500 | ~600 |
| Total Cost | Lower | Higher |
| Detail Level | Standard | Enhanced |
| Specialization | General | Specialized |

## Best Practices

### When to Use Single Agent Mode

- Quick analysis needed
- Cost is a concern
- Consistent formatting required
- Standard financial reports
- High-volume processing

### When to Use Multi-Agent Mode

- Comprehensive analysis required
- Specialized insights needed
- Complex financial documents
- Detailed risk assessment
- Strategic decision-making

## Error Handling

### Mode Validation

```javascript
// Invalid mode defaults to DEFAULT_RAG_MODE
if (!mode || !strategies[mode]) {
  mode = DEFAULT_RAG_MODE;
}

// Disabled mode throws error
if (!isModeEnabled(mode)) {
  throw new Error(`Mode '${mode}' is not enabled`);
}
```

### Graceful Degradation

1. Multi-Agent fails → Falls back to Single Agent
2. Single Agent fails → Returns error (no fallback)
3. Mode disabled → Returns error with available modes

## Monitoring & Analytics

### Tracking Mode Usage

The system logs mode usage for analytics:

```javascript
console.log(`[Orchestrator] Using ${strategy.name} strategy`);
console.log(`Mode used: ${result.metadata.mode}`);
```

### Metadata in Reports

Every report includes metadata for tracking:

```javascript
{
  mode: 'single' | 'multi',
  strategyName: string,
  timestamp: string,
  fallback?: boolean,
  originalMode?: string,
  fallbackReason?: string
}
```

## Testing

### Unit Tests (To Be Implemented)

```javascript
describe('RAGOrchestrator', () => {
  test('should use single agent mode by default', () => {});
  test('should fallback to single agent on multi-agent failure', () => {});
  test('should validate mode availability', () => {});
  test('should persist mode selection', () => {});
});
```

### Integration Tests

```bash
# Test single agent mode
curl -X POST http://localhost:3001/api/generate-report \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","companyName":"Test Co","mode":"single"}'

# Test multi-agent mode
curl -X POST http://localhost:3001/api/generate-report \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.pdf","companyName":"Test Co","mode":"multi"}'
```

## Future Enhancements

- [ ] Side-by-side comparison view
- [ ] Mode recommendation based on document type
- [ ] Custom agent configuration
- [ ] Performance metrics dashboard
- [ ] A/B testing framework
- [ ] Cost tracking per mode
- [ ] User preference learning

## Troubleshooting

### Mode Not Available

**Error**: `Mode 'multi' is not enabled`

**Solution**: Check `ENABLED_RAG_MODES` environment variable

### Fallback Always Occurring

**Issue**: Multi-Agent always falls back to Single Agent

**Possible Causes**:
- Insufficient API credits
- Rate limiting
- Invalid API key
- Network issues

**Solution**: Check logs for specific error, verify API key and credits

### Mode Selection Not Persisting

**Issue**: Selected mode resets on page reload

**Solution**: Check browser localStorage, ensure `localStorage.setItem('ragMode', mode)` is called

## Support

For issues or questions about the dual-mode system:
1. Check logs for detailed error messages
2. Verify environment variables are set correctly
3. Test with Single Agent mode first
4. Review API key and credits
5. Check network connectivity

---

**Last Updated**: 2024
**Version**: 1.0.0
