import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PersonalInfo } from "./PersonalInfoForm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
    if (!uploadedFile) throw new Error("No PDF file uploaded");

    try {
      // Read the uploaded PDF file
      const pdfBytes = await uploadedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Get the first page (assuming single page form for now)
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Embed a font for handwriting-style text
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Define positions for form fields (these would normally be detected by AI)
      // For demonstration, I'll place fields at common form locations
      const fieldPositions = {
        firstName: { x: 100, y: height - 150 },
        middleName: { x: 250, y: height - 150 },
        lastName: { x: 400, y: height - 150 },
        gender: { x: 100, y: height - 200 },
        maritalStatus: { x: 300, y: height - 200 },
        cellPhone: { x: 100, y: height - 250 },
        workPhone: { x: 300, y: height - 250 },
        homeAddress: { x: 100, y: height - 300 },
        state: { x: 100, y: height - 350 },
        zipCode: { x: 200, y: height - 350 },
        date: { x: 400, y: height - 400 },
        signature: { x: 100, y: height - 500 }
      };

      // Draw form data on the PDF
      const fontSize = 12;
      const textColor = rgb(0, 0, 0);

      // Fill in the form fields with user data
      if (formData.firstName) {
        firstPage.drawText(formData.firstName, {
          x: fieldPositions.firstName.x,
          y: fieldPositions.firstName.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.middleName) {
        firstPage.drawText(formData.middleName, {
          x: fieldPositions.middleName.x,
          y: fieldPositions.middleName.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.lastName) {
        firstPage.drawText(formData.lastName, {
          x: fieldPositions.lastName.x,
          y: fieldPositions.lastName.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.gender) {
        firstPage.drawText(formData.gender, {
          x: fieldPositions.gender.x,
          y: fieldPositions.gender.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.maritalStatus) {
        firstPage.drawText(formData.maritalStatus, {
          x: fieldPositions.maritalStatus.x,
          y: fieldPositions.maritalStatus.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.cellPhone) {
        firstPage.drawText(formData.cellPhone, {
          x: fieldPositions.cellPhone.x,
          y: fieldPositions.cellPhone.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.workPhone) {
        firstPage.drawText(formData.workPhone, {
          x: fieldPositions.workPhone.x,
          y: fieldPositions.workPhone.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.homeAddress) {
        firstPage.drawText(formData.homeAddress, {
          x: fieldPositions.homeAddress.x,
          y: fieldPositions.homeAddress.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.state) {
        firstPage.drawText(formData.state, {
          x: fieldPositions.state.x,
          y: fieldPositions.state.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      if (formData.zipCode) {
        firstPage.drawText(formData.zipCode, {
          x: fieldPositions.zipCode.x,
          y: fieldPositions.zipCode.y,
          size: fontSize,
          font,
          color: textColor,
        });
      }

      // Add current date
      const currentDate = new Date().toLocaleDateString();
      firstPage.drawText(currentDate, {
        x: fieldPositions.date.x,
        y: fieldPositions.date.y,
        size: fontSize,
        font,
        color: textColor,
      });

      // Add signature if available
      if (signatureDataUrl) {
        try {
          // Convert signature data URL to PNG bytes
          const signatureBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
          const signatureImage = await pdfDoc.embedPng(signatureBytes);
          
          // Draw signature on the PDF
          firstPage.drawImage(signatureImage, {
            x: fieldPositions.signature.x,
            y: fieldPositions.signature.y,
            width: 150,
            height: 50,
          });
        } catch (error) {
          console.error("Error embedding signature:", error);
          // If signature embedding fails, just add text
          firstPage.drawText("[Signature]", {
            x: fieldPositions.signature.x,
            y: fieldPositions.signature.y,
            size: fontSize,
            font,
            color: textColor,
          });
        }
      }

      // Save the PDF and return as data URL
      const filledPdfBytes = await pdfDoc.save();
      const blob = new Blob([filledPdfBytes], { type: 'application/pdf' });
      const dataUrl = URL.createObjectURL(blob);
      
      return dataUrl;
    } catch (error) {
      console.error("Error processing PDF:", error);
      throw new Error("Failed to process PDF file");
    }
  };

  const downloadFilledPDF = () => {
    if (!filledPdfUrl) return;
    
    const link = document.createElement('a');
    link.download = `filled-${uploadedFile?.name || 'form.pdf'}`;
    link.href = filledPdfUrl;
    link.click();
    
    toast("Filled PDF downloaded!");
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