import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Tenants from "@/pages/admin/Tenants";
import Channels from "@/pages/admin/Channels";
import Flows from "@/pages/admin/Flows";
import ApiDocs from "@/pages/admin/ApiDocs";
import Inbox from "@/pages/admin/Inbox";
import Auth from "@/pages/Auth";
import FlowBuilder from "@/pages/FlowBuilder";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/builder/:flowId" element={<FlowBuilder />} />
            <Route path="/builder" element={<FlowBuilder />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="tenants" element={<Tenants />} />
              <Route path="channels" element={<Channels />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="flows" element={<Flows />} />
              <Route path="api-docs" element={<ApiDocs />} />
            </Route>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
