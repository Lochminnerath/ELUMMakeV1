import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Benefits from "./pages/Benefits";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="container h-14 flex items-center justify-between">
              <Link to="/" className="font-bold tracking-tight text-lg flex items-center gap-2">
                <img
                  src="https://cdn.builder.io/api/v1/image/assets%2Fe66622eddf684604adcf1fff2dfb4c40%2Fff08989566164c079dea1361b6eaee7a?format=webp&width=800"
                  alt="SL Airlines"
                  className="h-8 w-8"
                />
                SL Airlines
              </Link>
              <nav className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link to="/" className="hover:text-foreground">Cancel</Link>
                <Link to="/benefits" className="hover:text-foreground">Benefits</Link>
                <a href="https://slairlines.netlify.app" target="_blank" rel="noreferrer" className="hover:text-foreground">Account</a>
              </nav>
            </div>
          </header>
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/benefits" element={<Benefits />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <footer className="border-t bg-background/80">
            <div className="container py-6 text-xs text-muted-foreground flex items-center justify-between">
              <div>© {new Date().getFullYear()} SL Airlines. All rights reserved.</div>
              <a
                href="https://sites.google.com/view/sl-airlines/our-policy"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Policies
              </a>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
