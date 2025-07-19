import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PersonalInfo } from "./PersonalInfoForm";
import { firstPageToJpeg, callDonut, fillTemplate, DetectedField } from "@/lib/pdfService";

interface PDFProcessorProps {
  formData: PersonalInfo;
  signatureDataUrl: string | null;
  hfToken: string;
}

export const PDFProcessor = ({ formData, signatureDataUrl, hfToken }: PDFProcessorProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processingResult, setProcessingResult] = useState<'complete' | 'incomplete' | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      setProcessingResult(null);
      setDownloadUrl(null);
      toast(`PDF uploaded: ${file.name}`);
    } else {
      toast.error("Please upload a valid PDF file");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const processPdf = useMutation({
    mutationFn: async () => {
      if (!uploadedFile) throw new Error("No PDF file uploaded");
      if (!signatureDataUrl) throw new Error("No signature provided");
      if (!hfToken) throw new Error("No Hugging Face token provided");

      // Convert PDF first page to JPEG
      const pdfArrayBuffer = await uploadedFile.arrayBuffer();
      const imgBlob = await firstPageToJpeg(pdfArrayBuffer);
      
      // Call Donut model for field detection
      const detectedFields = await callDonut(imgBlob, hfToken);
      
      // Check if we have usable fields
      if (detectedFields.length === 0) {
        throw new Error("No form fields could be detected");
      }
      
      // Fill the template with detected fields
      const filledPdfBytes = await fillTemplate(detectedFields, formData, signatureDataUrl, pdfArrayBuffer);
      
      return { filledPdfBytes, detectedFields };
    },
    onMutate: () => {
      toast.loading('Processing PDF with AI...', { id: 'pdf-processing' });
      setProcessingResult(null);
      setDownloadUrl(null);
    },
    onSuccess: (data) => {
      toast.dismiss('pdf-processing');
      toast.success('PDF processed successfully!');
      setProcessingResult('complete');
      
      // Create download URL
      const blob = new Blob([data.filledPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    },
    onError: (error) => {
      toast.dismiss('pdf-processing');
      console.error('PDF processing error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Processing failed: ${errorMessage}`);
      setProcessingResult('incomplete');
    }
  });

  const handleProcess = () => {
    if (!uploadedFile) {
      toast.error("Please upload a PDF file first");
      return;
    }
    if (!signatureDataUrl) {
      toast.error("Please create a signature first");
      return;
    }
    if (!hfToken) {
      toast.error("Please enter your Hugging Face API token first");
      return;
    }
    
    processPdf.mutate();
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    
    const link = document.createElement('a');
    link.download = 'filled-form.pdf';
    link.href = downloadUrl;
    link.click();
    
    toast.success("PDF downloaded!");
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader className="bg-gradient-primary text-white">
        <CardTitle className="text-xl font-semibold">PDF Form Processor</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        
        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted hover:border-primary hover:bg-muted/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-4">
            <Upload className="w-12 h-12 text-muted-foreground" />
            {uploadedFile ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Click or drag to replace
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? "Drop PDF here" : "Upload PDF Form"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop a PDF file here, or click to select
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Process Button */}
        <Button 
          onClick={handleProcess}
          disabled={!uploadedFile || processPdf.isPending}
          className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
          size="lg"
        >
          {processPdf.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Processing with AI...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Process & Fill Form with AI
            </>
          )}
        </Button>

        {/* Results */}
        {processingResult && (
          <div className={`rounded-lg p-4 border-2 ${
            processingResult === 'complete' 
              ? 'border-green-200 bg-green-50 text-green-800' 
              : 'border-orange-200 bg-orange-50 text-orange-800'
          }`}>
            <div className="flex items-center space-x-2">
              {processingResult === 'complete' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
              <span className="font-medium">
                Form Processing: {processingResult === 'complete' ? 'Complete' : 'Incomplete'}
              </span>
            </div>
            <p className="mt-2 text-sm">
              {processingResult === 'complete' 
                ? 'Your form has been successfully filled and is ready for download.'
                : 'Some required information is missing or form fields could not be automatically detected.'
              }
            </p>
          </div>
        )}

        {/* Download Button */}
        {downloadUrl && (
          <Button 
            onClick={handleDownload}
            className="w-full"
            variant="outline"
            size="lg"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Filled PDF
          </Button>
        )}
      </CardContent>
    </Card>
  );
};