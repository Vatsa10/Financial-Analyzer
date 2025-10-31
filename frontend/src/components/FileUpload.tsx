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
            className={`p-8 border-2 border-dashed transition-all cursor-pointer shadow-2xl ${
              isDragOver 
                ? 'backdrop-blur-xl bg-white/60 border-black/50 scale-105' 
                : 'backdrop-blur-xl bg-white/40 border-white/40 hover:bg-white/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <div className="text-center space-y-4">
              <div className="backdrop-blur-sm bg-black/10 p-3 rounded-full w-fit mx-auto shadow-lg">
                <Upload className="h-8 w-8 text-black" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-black mb-2">
                  Upload Financial Document
                </h3>
                <p className="text-gray-600 mb-4">
                  Drag and drop your PDF file here, or click to browse
                </p>
                
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
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
            <Card className="p-6 backdrop-blur-xl bg-white/50 border border-white/40 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-black" />
                  <div>
                    <h4 className="font-semibold text-black">{selectedFile.name}</h4>
                    <p className="text-sm text-gray-700">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                
                <Button onClick={handleUploadClick} className="backdrop-blur-md bg-black/80 hover:bg-black/90 text-white border border-white/20 shadow-lg">
                  Process Document
                </Button>
              </div>
            </Card>
          )}
        </div>
      </TabsContent>
      
      <TabsContent value="url">
        <Card className="p-8 backdrop-blur-xl bg-white/40 border border-white/30 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="backdrop-blur-sm bg-black/10 p-3 rounded-full w-fit mx-auto shadow-lg">
              <Link className="h-8 w-8 text-black" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-black mb-2">
                Process Financial Document from URL
              </h3>
              <p className="text-gray-700 mb-4">
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
              className="backdrop-blur-md bg-white/50 border border-white/40 shadow-lg"
            />
            <Button onClick={handleUrlSubmit} className="backdrop-blur-md bg-black/80 hover:bg-black/90 text-white border border-white/20 shadow-lg">
              Fetch and Process
            </Button>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
