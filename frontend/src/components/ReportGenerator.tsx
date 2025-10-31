import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2 } from 'lucide-react';

interface ReportGeneratorProps {
  file: File;
  onStartAnalysis: (companyName: string) => void;
  isProcessing: boolean;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  file,
  onStartAnalysis,
  isProcessing,
}) => {
  const [companyName, setCompanyName] = useState('');
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!companyName.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter the company name to proceed.",
        variant: "destructive",
      });
      return;
    }

    onStartAnalysis(companyName);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 backdrop-blur-xl bg-white/40 border border-white/30 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <FileText className="h-6 w-6 text-black" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-black">Financial Document Ready for Analysis</h3>
            <p className="text-gray-700">{file.name}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="companyName" className="text-black font-medium">Company Name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Apple Inc., Microsoft Corporation, Tesla Inc."
              className="mt-1 backdrop-blur-md bg-white/50 border border-white/40 shadow-lg"
              disabled={isProcessing}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-center">
        <Button
          onClick={handleGenerate}
          className="backdrop-blur-md bg-black/80 hover:bg-black/90 text-white border border-white/20 w-full md:w-auto px-8 flex items-center gap-2 shadow-xl"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze Financial Document'
          )}
        </Button>
      </div>
    </div>
  );
};
