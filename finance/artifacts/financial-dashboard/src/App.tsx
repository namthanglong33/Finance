import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinancialProvider } from "./context/FinancialContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import InputPage from "./pages/input";
import ResultsPage from "./pages/results";
import OptimizePage from "./pages/optimize";
import CalculationPage from "./pages/calculation";
import LoginPage from "./pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/input" component={InputPage} />
        <Route path="/results" component={ResultsPage} />
        <Route path="/optimize" component={OptimizePage} />
        <Route path="/calculation" component={CalculationPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FinancialProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </FinancialProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
