import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, Zap, Users } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type RAGMode = 'single' | 'multi';

interface ModeSelectorProps {
  selectedMode: RAGMode;
  onModeChange: (mode: RAGMode) => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onModeChange,
  disabled = false
}) => {
  const modes = [
    {
      id: 'single' as RAGMode,
      name: 'Single Agent',
      icon: Zap,
      description: 'Fast, unified analysis with consistent output',
      features: [
        'Faster processing time',
        'Consistent formatting',
        'Lower API costs',
        'Ideal for quick insights'
      ],
      color: 'from-gray-600 to-black'
    },
    {
      id: 'multi' as RAGMode,
      name: 'Multi-Agent',
      icon: Users,
      description: 'Specialized agents for deeper, more nuanced analysis',
      features: [
        'Specialized expertise per section',
        'More detailed analysis',
        'Better context understanding',
        'Ideal for comprehensive reports'
      ],
      color: 'from-black to-gray-600'
    }
  ];

  return (
    <Card className="backdrop-blur-xl bg-white/40 border border-white/30 shadow-2xl p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-black">Analysis Mode</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-600" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Choose between fast single-agent analysis or comprehensive multi-agent analysis with specialized expertise.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge variant="secondary" className="backdrop-blur-md bg-white/60 text-black border border-white/40">
            {selectedMode === 'single' ? 'Single Agent' : 'Multi-Agent'}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = selectedMode === mode.id;
            
            return (
              <button
                key={mode.id}
                onClick={() => !disabled && onModeChange(mode.id)}
                disabled={disabled}
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-300
                  ${isSelected
                    ? 'border-black bg-gradient-to-br ' + mode.color + ' text-white shadow-xl scale-105'
                    : 'border-white/40 backdrop-blur-md bg-white/30 hover:bg-white/50 text-black'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-102'}
                `}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-black/10'}`}>
                        <Icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-black'}`} />
                      </div>
                      <span className="font-semibold">{mode.name}</span>
                    </div>
                    {isSelected && (
                      <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                    )}
                  </div>
                  
                  <p className={`text-sm ${isSelected ? 'text-white/90' : 'text-gray-700'}`}>
                    {mode.description}
                  </p>
                  
                  <div className="space-y-1">
                    {mode.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <span className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                          •
                        </span>
                        <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-gray-600 text-center pt-2">
          Your selection is saved automatically
        </div>
      </div>
    </Card>
  );
};
