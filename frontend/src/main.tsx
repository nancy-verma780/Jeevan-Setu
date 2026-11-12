import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@/lib/i18n";
import "@/styles/index.css";
import { ToastProvider } from "@/components/ui/Toast";
import { DrillProvider } from "@/features/drill/DrillContext";
import { ApiError } from "@/lib/api/client";
import { App } from "./App";
import { applyDisplayPrefs, readDisplayPrefs } from "@/lib/hooks/useDisplayPrefs";

applyDisplayPrefs(readDisplayPrefs());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <DrillProvider>
            <App />
          </DrillProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
