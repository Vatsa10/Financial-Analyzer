import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, AlertCircle, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  onUrlSubmit: (url: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, onUrlSubmit }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  const handleUrlSubmit = () => {
    if (url.trim()) {
      onUrlSubmit(url.trim());
      setUrl('');
    }
  };

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="upload">Upload Document</TabsTrigger>
        <TabsTrigger value="url">From URL</TabsTrigger>
      </TabsList>

      <TabsContent value="upload">
        <div className="space-y-6">
          <Card 
            className={`p-8 border-2 border-dashed transition-colors cursor-pointer hover:bg-slate-50 ${
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <div className="text-center space-y-4">
              <div className="bg-blue-100 p-3 rounded-full w-fit mx-auto">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Upload Financial Document
                </h3>
                <p className="text-slate-600 mb-4">
                  Drag and drop your PDF file here, or click to browse
                </p>
                
                <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>Supports quarterly reports, SEC filings, 10-K/10-Q forms, earnings transcripts, annual reports</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </Card>

          {selectedFile && (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <h4 className="font-semibold text-slate-900">{selectedFile.name}</h4>
                    <p className="text-sm text-slate-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                
                <Button onClick={handleUploadClick} className="bg-blue-600 hover:bg-blue-700">
                  Process Document
                </Button>
              </div>
            </Card>
          )}
        </div>
      </TabsContent>
      
      <TabsContent value="url">
        <Card className="p-8">
          <div className="text-center space-y-4">
            <div className="bg-blue-100 p-3 rounded-full w-fit mx-auto">
              <Link className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Process Financial Document from URL
              </h3>
              <p className="text-slate-600 mb-4">
                Enter the public URL of a PDF financial document (SEC filings, quarterly reports, etc.).
              </p>
            </div>
          </div>
          <div className="flex w-full items-center space-x-2 mt-4">
            <Input 
              type="url" 
              placeholder="https://example.com/10k-report.pdf" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={handleUrlSubmit} className="bg-blue-600 hover:bg-blue-700">
              Fetch and Process
            </Button>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
