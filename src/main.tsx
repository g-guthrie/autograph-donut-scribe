import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/pdfWorker'

createRoot(document.getElementById("root")!).render(<App />);
