import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';

// Alternative worker setup approach
const setupWorker = () => {
  try {
    // Try jsDelivr first
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
  } catch (error) {
    console.warn('Failed to set up worker from CDN, trying alternative...');
    // Fallback to a different CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
};

setupWorker();

export interface DetectedField {
  field: string;
  value: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
}

export interface PersonalInfo {
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: string;
  maritalStatus: string;
  cellPhone: string;
  workPhone?: string;
  homeAddress: string;
  state: string;
  zipCode: string;
}

export async function firstPageToJpeg(pdfArrayBuffer: ArrayBuffer): Promise<Blob> {
  const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
  });
}

export async function callDonut(imgBlob: Blob, token: string): Promise<DetectedField[]> {
  const res = await fetch(
    'https://api-inference.huggingface.co/models/naver-clova-ix/donut-base-finetuned-cord-v2',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      body: imgBlob
    }
  );
  
  if (!res.ok) throw new Error(`HF error ${res.status}`);
  
  const result = await res.json();
  console.log("Raw Donut model result:", result);
  
  const detectedFields: DetectedField[] = [];
  
  if (result && Array.isArray(result) && result.length > 0) {
    result.forEach((item: any) => {
      if (item.word && item.bbox) {
        detectedFields.push({
          field: item.word.toLowerCase(),
          bbox: item.bbox,
          value: '',
          confidence: item.confidence || 0.9
        });
      }
    });
  } else if (result && typeof result === 'object') {
    Object.keys(result).forEach(key => {
      if (result[key] && result[key].bbox) {
        detectedFields.push({
          field: key.toLowerCase(),
          bbox: result[key].bbox,
          value: '',
          confidence: result[key].confidence || 0.9
        });
      }
    });
  }
  
  // Fallback simulation if no fields detected
  if (detectedFields.length === 0) {
    const basicFields = [
      { field: 'first_name', bbox: [100, 150, 200, 170] as [number, number, number, number] },
      { field: 'last_name', bbox: [250, 150, 350, 170] as [number, number, number, number] },
      { field: 'phone', bbox: [100, 200, 250, 220] as [number, number, number, number] },
      { field: 'address', bbox: [100, 250, 400, 270] as [number, number, number, number] },
      { field: 'signature', bbox: [100, 400, 250, 450] as [number, number, number, number] }
    ];
    
    detectedFields.push(...basicFields.map(field => ({
      ...field,
      value: '',
      confidence: 0.9
    })));
  }
  
  return detectedFields;
}

function scaleBox(box: number[], imgW: number, imgH: number, pdfW: number, pdfH: number): [number, number, number, number] {
  const [x0, y0, x1, y1] = box;
  return [
    (x0 / imgW) * pdfW,
    pdfH - (y1 / imgH) * pdfH,   // flip y‑axis
    ((x1 - x0) / imgW) * pdfW,
    ((y1 - y0) / imgH) * pdfH
  ];
}

export async function fillTemplate(
  fields: DetectedField[], 
  personalInfo: PersonalInfo, 
  signatureDataUrl: string | null, 
  originalPdfBytes: ArrayBuffer
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];
  const { width, height } = page.getSize();

  // Embed font
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
    console.warn("Could not load custom font, using Helvetica");
    const { StandardFonts } = await import('pdf-lib');
    customFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  }

  const fontSize = 14;
  const textColor = rgb(0.2, 0.2, 0.8);

  // Fill detected fields
  for (const detectedField of fields) {
    let valueToInsert = '';
    
    switch (detectedField.field.toLowerCase()) {
      case 'first_name':
      case 'firstname':
        valueToInsert = personalInfo.firstName || '';
        break;
      case 'middle_name':
      case 'middlename':
        valueToInsert = personalInfo.middleName || '';
        break;
      case 'last_name':
      case 'lastname':
        valueToInsert = personalInfo.lastName || '';
        break;
      case 'gender':
        valueToInsert = personalInfo.gender || '';
        break;
      case 'marital_status':
      case 'maritalstatus':
        valueToInsert = personalInfo.maritalStatus || '';
        break;
      case 'phone':
      case 'cell_phone':
      case 'cellphone':
        valueToInsert = personalInfo.cellPhone || '';
        break;
      case 'work_phone':
      case 'workphone':
        valueToInsert = personalInfo.workPhone || '';
        break;
      case 'address':
      case 'home_address':
      case 'homeaddress':
        valueToInsert = personalInfo.homeAddress || '';
        break;
      case 'state':
        valueToInsert = personalInfo.state || '';
        break;
      case 'zip':
      case 'zipcode':
      case 'zip_code':
        valueToInsert = personalInfo.zipCode || '';
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
            page.drawImage(png, {
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

    if (valueToInsert) {
      const [x1, y1, x2, y2] = detectedField.bbox;
      page.drawText(valueToInsert, {
        x: x1 + 5,
        y: height - y2 + 5,
        size: fontSize,
        font: customFont,
        color: textColor,
      });
    }
  }

  return await pdfDoc.save();
}