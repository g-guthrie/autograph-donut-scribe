import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PersonalInfo } from "./PersonalInfoForm";

interface PDFProcessorProps {
  formData: PersonalInfo;
  signatureDataUrl: string | null;
}

export const PDFProcessor = ({ formData, signatureDataUrl }: PDFProcessorProps) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<'complete' | 'incomplete' | null>(null);
  const [filledPdfUrl, setFilledPdfUrl] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      setProcessingResult(null);
      setFilledPdfUrl(null);
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

  const processForm = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a PDF file first");
      return;
    }

    if (!signatureDataUrl) {
      toast.error("Please create a signature first");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simulate AI form processing - in real implementation, this would use the Donut model
      // For now, we'll simulate basic form detection and filling
      await simulateFormProcessing();
      
    } catch (error) {
      console.error("Error processing form:", error);
      toast.error("Error processing form");
      setProcessingResult('incomplete');
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateFormProcessing = async () => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we have all required basic information
    const hasBasicInfo = formData.firstName && 
                        formData.lastName && 
                        (formData.cellPhone || formData.workPhone) && 
                        formData.homeAddress && 
                        formData.state && 
                        formData.zipCode;

    if (hasBasicInfo) {
      // Simulate successful form filling
      const filledPdf = await generateFilledPDF();
      setFilledPdfUrl(filledPdf);
      setProcessingResult('complete');
      toast.success("Form successfully filled and ready for download!");
    } else {
      setProcessingResult('incomplete');
      toast.error("Insufficient information to fill the form completely");
    }
  };

  const generateFilledPDF = async (): Promise<string> => {
    // In a real implementation, this would:
    // 1. Convert PDF to image if needed
    // 2. Use AI to detect form fields
    // 3. Fill detected fields with user data in handwriting font
    // 4. Add current date
    // 5. Overlay signature image
    // 6. Generate filled PDF
    
    // For now, we'll create a simple filled PDF simulation
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add form title
      ctx.fillStyle = '#000000';
      ctx.font = '24px Arial';
      ctx.fillText('Filled Form', 50, 50);
      
      // Add filled information in handwriting style
      ctx.font = '18px Dancing Script, cursive';
      let yPosition = 100;
      
      const addField = (label: string, value: string) => {
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial';
        ctx.fillText(label + ':', 50, yPosition);
        
        ctx.fillStyle = '#000000';
        ctx.font = '18px Dancing Script, cursive';
        ctx.fillText(value, 200, yPosition);
        yPosition += 40;
      };
      
      addField('First Name', formData.firstName);
      addField('Middle Name', formData.middleName);
      addField('Last Name', formData.lastName);
      addField('Gender', formData.gender);
      addField('Marital Status', formData.maritalStatus);
      addField('Cell Phone', formData.cellPhone);
      addField('Work Phone', formData.workPhone);
      addField('Home Address', formData.homeAddress);
      addField('State', formData.state);
      addField('ZIP Code', formData.zipCode);
      addField('Date', new Date().toLocaleDateString());
      
      // Add signature if available
      if (signatureDataUrl) {
        const img = new Image();
        return new Promise((resolve) => {
          img.onload = () => {
            ctx.fillText('Signature:', 50, yPosition);
            ctx.drawImage(img, 200, yPosition - 20, 200, 60);
            
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          };
          img.src = signatureDataUrl;
        });
      }
    }
    
    return canvas.toDataURL('image/png');
  };

  const downloadFilledPDF = () => {
    if (!filledPdfUrl) return;
    
    const link = document.createElement('a');
    link.download = 'filled-form.png'; // In real implementation, this would be a PDF
    link.href = filledPdfUrl;
    link.click();
    
    toast("Filled form downloaded!");
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
          onClick={processForm}
          disabled={!uploadedFile || isProcessing}
          className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
          size="lg"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Processing Form...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Process & Fill Form
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
                ? 'All basic fields detected and filled. Form is ready for download.'
                : 'Some required information is missing or form fields could not be automatically detected.'}
            </p>
          </div>
        )}

        {/* Download Button */}
        {filledPdfUrl && (
          <Button 
            onClick={downloadFilledPDF}
            className="w-full bg-green-600 hover:bg-green-700 text-white transition-smooth"
            size="lg"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Filled Form
          </Button>
        )}
      </CardContent>
    </Card>
  );
};