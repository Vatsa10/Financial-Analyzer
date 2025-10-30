import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, Loader2, Lightbulb } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  companyName: string;
  onAskQuestion: (question: string) => Promise<string>;
  isLoading?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  companyName,
  onAskQuestion,
  isLoading = false
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Premade questions
  const premadeQuestions = [
    "What is the expected revenue growth in the coming quarters?",
    "What are the main risk factors that could impact creditworthiness?",
    "How is the company's financial health and debt position?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message when component mounts
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        type: 'assistant',
        content: `Hello! I'm ready to answer questions about ${companyName}'s credit report. You can ask me anything about the company's financials, risks, growth prospects, or management commentary.`,
        timestamp: new Date()
      }]);
    }
  }, [companyName, messages.length]);

  const handleAskQuestion = async (question: string) => {
    if (!question.trim() || isAsking) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: question.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentQuestion('');
    setIsAsking(true);

    try {
      const answer = await onAskQuestion(question.trim());
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: answer,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAsking(false);
    }
  };

  const handlePremadeQuestion = (question: string) => {
    handleAskQuestion(question);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAskQuestion(currentQuestion);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Preparing chat interface...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chat Header */}
      <div className="flex items-center space-x-3">
        <MessageCircle className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-slate-900">Ask Questions About {companyName}</h2>
      </div>

      {/* Premade Questions */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center space-x-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-medium text-blue-900">Quick Questions:</h3>
        </div>
        <div className="space-y-2">
          {premadeQuestions.map((question, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="text-left justify-start h-auto p-3 text-blue-700 border-blue-300 hover:bg-blue-100 whitespace-normal"
              onClick={() => handlePremadeQuestion(question)}
              disabled={isAsking}
            >
              {question}
            </Button>
          ))}
        </div>
      </Card>

      {/* Chat Messages */}
      <Card className="p-4">
        <div className="h-96 overflow-y-auto space-y-4 mb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-slate-500'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isAsking && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-900 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Analyzing report...</p>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={currentQuestion}
            onChange={(e) => setCurrentQuestion(e.target.value)}
            placeholder="Ask a question about the report..."
            disabled={isAsking}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!currentQuestion.trim() || isAsking}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isAsking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}; 