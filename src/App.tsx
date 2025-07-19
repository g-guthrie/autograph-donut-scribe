import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [hfToken, setHfToken] = useState<string>('');   // clears on refresh

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-gradient-subtle">
            {/* Global HF Token Input */}
            <div className="bg-background border-b">
              <div className="container mx-auto px-4 py-3">
                <div className="flex items-center space-x-4 max-w-md">
                  <Label htmlFor="global-hf-token" className="text-sm font-medium whitespace-nowrap">
                    HF Token:
                  </Label>
                  <Input
                    id="global-hf-token"
                    type="password"
                    placeholder="Key is kept in memory and clears on refresh"
                    value={hfToken}
                    onChange={e => setHfToken(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            
            <Routes>
              <Route path="/" element={<Index hfToken={hfToken} />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
