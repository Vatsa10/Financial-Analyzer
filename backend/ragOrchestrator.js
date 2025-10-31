/**
 * RAG Orchestrator
 * Manages strategy selection and execution
 */

const SingleAgentStrategy = require('./strategies/singleAgentStrategy');
const MultiAgentStrategy = require('./strategies/multiAgentStrategy');

class RAGOrchestrator {
  constructor() {
    this.strategies = {
      single: new SingleAgentStrategy(),
      multi: new MultiAgentStrategy()
    };
    
    this.defaultMode = process.env.DEFAULT_RAG_MODE || 'single';
    this.enabledModes = (process.env.ENABLED_RAG_MODES || 'single,multi').split(',');
  }

  /**
   * Validate if the requested mode is enabled
   */
  isModeEnabled(mode) {
    return this.enabledModes.includes(mode);
  }

  /**
   * Get strategy information
   */
  getStrategyInfo(mode) {
    const strategy = this.strategies[mode];
    if (!strategy) return null;
    
    return {
      name: strategy.name,
      description: strategy.description,
      enabled: this.isModeEnabled(mode)
    };
  }

  /**
   * Get all available strategies
   */
  getAllStrategies() {
    return Object.keys(this.strategies).map(mode => ({
      mode,
      ...this.getStrategyInfo(mode)
    }));
  }

  /**
   * Process report generation request
   */
  async generateReport({ mode, extractedText, companyName, apiKey }) {
    // Validate mode
    if (!mode || !this.strategies[mode]) {
      console.warn(`Invalid mode '${mode}', falling back to ${this.defaultMode}`);
      mode = this.defaultMode;
    }

    if (!this.isModeEnabled(mode)) {
      throw new Error(`Mode '${mode}' is not enabled. Available modes: ${this.enabledModes.join(', ')}`);
    }

    const strategy = this.strategies[mode];
    console.log(`[Orchestrator] Using ${strategy.name} strategy`);

    try {
      const result = await strategy.execute({
        extractedText,
        companyName,
        apiKey
      });

      return {
        ...result,
        metadata: {
          mode,
          strategyName: strategy.name,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`[Orchestrator] Error in ${strategy.name}:`, error.message);
      
      // Fallback to single agent if multi-agent fails
      if (mode === 'multi' && this.isModeEnabled('single')) {
        console.log('[Orchestrator] Falling back to Single Agent mode');
        const fallbackStrategy = this.strategies.single;
        const result = await fallbackStrategy.execute({
          extractedText,
          companyName,
          apiKey
        });
        
        return {
          ...result,
          metadata: {
            mode: 'single',
            strategyName: fallbackStrategy.name,
            timestamp: new Date().toISOString(),
            fallback: true,
            originalMode: mode,
            fallbackReason: error.message
          }
        };
      }
      
      throw error;
    }
  }

  /**
   * Process Q&A request
   */
  async answerQuestion({ mode, vectorStore, question, companyName, apiKey }) {
    // Validate mode
    if (!mode || !this.strategies[mode]) {
      console.warn(`Invalid mode '${mode}', falling back to ${this.defaultMode}`);
      mode = this.defaultMode;
    }

    if (!this.isModeEnabled(mode)) {
      throw new Error(`Mode '${mode}' is not enabled`);
    }

    const strategy = this.strategies[mode];
    console.log(`[Orchestrator] Answering question using ${strategy.name} strategy`);

    try {
      const answer = await strategy.answerQuestion({
        vectorStore,
        question,
        companyName,
        apiKey
      });

      return {
        answer,
        mode,
        strategyName: strategy.name
      };
    } catch (error) {
      console.error(`[Orchestrator] Error in Q&A with ${strategy.name}:`, error.message);
      
      // Fallback to single agent if multi-agent fails
      if (mode === 'multi' && this.isModeEnabled('single')) {
        console.log('[Orchestrator] Falling back to Single Agent mode for Q&A');
        const fallbackStrategy = this.strategies.single;
        const answer = await fallbackStrategy.answerQuestion({
          vectorStore,
          question,
          companyName,
          apiKey
        });
        
        return {
          answer,
          mode: 'single',
          strategyName: fallbackStrategy.name,
          fallback: true,
          originalMode: mode
        };
      }
      
      throw error;
    }
  }
}

// Singleton instance
const orchestrator = new RAGOrchestrator();

module.exports = orchestrator;
