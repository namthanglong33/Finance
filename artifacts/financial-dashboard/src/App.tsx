import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinancialProvider } from "./context/FinancialContext";
import { Layout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import InputPage from "./pages/input";
import ResultsPage from "./pages/results";
import OptimizePage from "./pages/optimize";
import CalculationPage from "./pages/calculation";
import ContractsPage from "./pages/contracts";
import OptimizedResultsPage from "./pages/optimized-results";
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
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/input" component={InputPage} />
        <Route path="/results" component={ResultsPage} />
        <Route path="/optimize" component={OptimizePage} />
        <Route path="/optimized-results" component={OptimizedResultsPage} />
        <Route path="/calculation" component={CalculationPage} />
        <Route path="/contracts" component={ContractsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FinancialProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </FinancialProvider>
    </QueryClientProvider>
  );
}

export default App;
