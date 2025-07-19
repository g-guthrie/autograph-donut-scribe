import { GlobalWorkerOptions } from 'pdfjs-dist';

// More reliable worker setup for different environments
const setupPdfWorker = () => {
  // Try multiple CDN sources in order of reliability
  const workerSources = [
    'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js'
  ];

  // Use a stable version that's known to work
  GlobalWorkerOptions.workerSrc = workerSources[0];
};

setupPdfWorker();