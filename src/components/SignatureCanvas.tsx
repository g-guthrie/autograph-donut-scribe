import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Download } from "lucide-react";
import { toast } from "sonner";

interface SignatureCanvasProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  signatureDataUrl: string | null;
}

export const SignatureCanvas = ({ onSignatureChange, signatureDataUrl }: SignatureCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 600;
    canvas.height = 200;
    
    // Set drawing properties
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Clear canvas with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load existing signature if available
    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = signatureDataUrl;
    }
  }, [signatureDataUrl]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSignatureChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    onSignatureChange(null);
    toast("Signature cleared!");
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL("image/png");
    
    const link = document.createElement("a");
    link.download = "signature.png";
    link.href = dataUrl;
    link.click();
    
    toast("Signature downloaded!");
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader className="bg-gradient-primary text-white">
        <CardTitle className="text-xl font-semibold">Digital Signature</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="border-2 border-dashed border-muted rounded-lg p-4 bg-muted/20">
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Draw your signature in the box below
            </p>
            <div className="flex justify-center">
              <canvas 
                ref={canvasRef} 
                className="border-2 border-border rounded-md bg-white shadow-sm cursor-crosshair" 
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={handleClear} 
              variant="outline"
              className="flex-1 border-2 border-destructive text-destructive hover:bg-destructive hover:text-white transition-smooth"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button 
              onClick={handleDownload} 
              variant="outline"
              className="flex-1 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-smooth"
              disabled={!signatureDataUrl}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};