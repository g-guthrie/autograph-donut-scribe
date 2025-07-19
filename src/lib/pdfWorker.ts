import * as pdfjsLib from 'pdfjs-dist';

// Use CDN for reliable worker loading across all environments
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;