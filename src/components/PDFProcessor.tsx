import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PersonalInfo } from "./PersonalInfoForm";
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PDFProcessorProps {
  formData: PersonalInfo;
  signatureDataUrl: string | null;
  hfToken: string;
}

interface DetectedField {
  field: string;
  bbox: [number, number, number, number];
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

  // Enhanced PDF to image conversion with higher quality
  const convertPdfToImage = async (pdfArrayBuffer: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 3.0 }); // Increased scale for better quality
    
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    return canvas.toDataURL('image/jpeg', 0.95); // High quality JPEG
  };

  // Enhanced field detection with better parsing
  const detectFields = async (imageBase64: string, token: string): Promise<DetectedField[]> => {
    if (!token || !token.startsWith('hf_')) {
      throw new Error('Valid Hugging Face token is required');
    }
    
    const response = await fetch('https://api-inference.huggingface.co/models/naver-clova-ix/donut-base-finetuned-cord-v2', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ inputs: imageBase64 })
    });
    
    if (!response.ok) {
      throw new Error(`Donut API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Donut result:', result); // For debugging
    
    const detectedFields: DetectedField[] = [];
    
    // Handle different response formats
    if (result && Array.isArray(result)) {
      result.forEach((item: any) => {
        if (item.word && item.bbox) {
          detectedFields.push({ 
            field: item.word.toLowerCase(), 
            bbox: item.bbox 
          });
        }
      });
    } else if (result && typeof result === 'object') {
      Object.keys(result).forEach(key => {
        if (result[key] && result[key].bbox) {
          detectedFields.push({ 
            field: key.toLowerCase(), 
            bbox: result[key].bbox 
          });
        }
      });
    }
    
    console.log('Parsed detected fields:', detectedFields); // Additional debugging
    return detectedFields;
  };

  // Enhanced PDF filling with better field mapping
  const generateFilledPDF = async (detectedFields: DetectedField[], pdfArrayBuffer: ArrayBuffer): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Embed Dancing Script font for handwritten style
    let customFont;
    try {
      const fontResponse = await fetch('https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3ROpY.woff2');
      if (fontResponse.ok) {
        const fontBytes = await fontResponse.arrayBuffer();
        customFont = await pdfDoc.embedFont(fontBytes);
      } else {
        throw new Error("Font not found");
      }
    } catch (error) {
      console.warn("Could not load Dancing Script font, using Helvetica");
      customFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    }

    const fontSize = 14;
    const textColor = rgb(0.2, 0.2, 0.8);

    // Fill detected fields with enhanced mapping
    for (const detectedField of detectedFields) {
      let valueToInsert = '';
      
      // Enhanced field mapping with synonyms
      switch (detectedField.field.toLowerCase()) {
        case 'first_name':
        case 'firstname':
        case 'first name':
          valueToInsert = formData.firstName || '';
          break;
        case 'middle_name':
        case 'middlename':
        case 'middle name':
          valueToInsert = formData.middleName || '';
          break;
        case 'last_name':
        case 'lastname':
        case 'last name':
          valueToInsert = formData.lastName || '';
          break;
        case 'full_name':
        case 'fullname':
        case 'full name':
        case 'name':
          valueToInsert = `${formData.firstName} ${formData.middleName || ''} ${formData.lastName}`.replace(/\s+/g, ' ').trim();
          break;
        case 'gender':
          valueToInsert = formData.gender || '';
          break;
        case 'marital_status':
        case 'maritalstatus':
        case 'marital status':
          valueToInsert = formData.maritalStatus || '';
          break;
        case 'phone':
        case 'cell_phone':
        case 'cellphone':
        case 'cell phone':
        case 'mobile':
          valueToInsert = formData.cellPhone || '';
          break;
        case 'work_phone':
        case 'workphone':
        case 'work phone':
          valueToInsert = formData.workPhone || '';
          break;
        case 'address':
        case 'home_address':
        case 'homeaddress':
        case 'home address':
          valueToInsert = formData.homeAddress || '';
          break;
        case 'state':
          valueToInsert = formData.state || '';
          break;
        case 'zip':
        case 'zipcode':
        case 'zip_code':
        case 'zip code':
        case 'postal':
          valueToInsert = formData.zipCode || '';
          break;
        case 'date':
          valueToInsert = new Date().toLocaleDateString();
          break;
        case 'signature':
          if (signatureDataUrl) {
            try {
              const pngBytes = Uint8Array.from(
                atob(signatureDataUrl.split(',')[1]),
                c => c.charCodeAt(0)
              );
              const png = await pdfDoc.embedPng(pngBytes);
              
              const [x1, y1, x2, y2] = detectedField.bbox;
              firstPage.drawImage(png, {
                x: x1 + 5,
                y: height - y2 - 5,
                width: Math.min(x2 - x1 - 10, 150),
                height: Math.min(y2 - y1 - 10, 50),
              });
            } catch (error) {
              console.error("Error embedding signature:", error);
            }
          }
          continue;
      }

      // Draw text if we have a value
      if (valueToInsert) {
        const [x1, y1, x2, y2] = detectedField.bbox;
        firstPage.drawText(valueToInsert, {
          x: x1 + 10,
          y: height - y1 - fontSize,
          size: fontSize,
          font: customFont,
          color: textColor,
        });
      }
    }

    return await pdfDoc.save();
  };

  const processPdf = useMutation({
    mutationFn: async () => {
      if (!uploadedFile) throw new Error("No PDF file uploaded");
      if (!signatureDataUrl) throw new Error("No signature provided");
      if (!hfToken) throw new Error("Hugging Face token is required");

      // Convert PDF first page to high-quality image
      const pdfArrayBuffer = await uploadedFile.arrayBuffer();
      const imageBase64 = await convertPdfToImage(pdfArrayBuffer);
      
      // Detect fields using Donut model
      const detectedFields = await detectFields(imageBase64, hfToken);
      
      // Check if we have basic fields detected
      const basicFields = ['first_name', 'last_name', 'phone', 'address', 'signature'];
      const hasBasicFields = detectedFields.some(field => 
        basicFields.some(basic => field.field.toLowerCase().includes(basic))
      );
      
      if (detectedFields.length === 0) {
        throw new Error("No form fields could be detected. Please try a different PDF with clear field labels.");
      }
      
      // Fill the PDF with detected fields
      const filledPdfBytes = await generateFilledPDF(detectedFields, pdfArrayBuffer);
      
      return { 
        filledPdfBytes, 
        detectedFields, 
        isComplete: hasBasicFields && detectedFields.length >= 3 
      };
    },
    onMutate: () => {
      toast.loading('Processing PDF with AI...', { id: 'pdf-processing' });
      setProcessingResult(null);
      setDownloadUrl(null);
    },
    onSuccess: (data) => {
      toast.dismiss('pdf-processing');
      toast.success(`PDF processed successfully! Detected ${data.detectedFields.length} fields.`);
      setProcessingResult(data.isComplete ? 'complete' : 'incomplete');
      
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
    link.download = 'filled.pdf';
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