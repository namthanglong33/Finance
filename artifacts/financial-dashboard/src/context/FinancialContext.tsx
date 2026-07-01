import React, { createContext, useContext, useState, ReactNode } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import type { FinancialInput, FinancialResult } from "@workspace/api-client-react";

export const DEFAULT_INPUT: FinancialInput = {
  constructionValue: 15000000000,
  supervisionRate: 0.03285,
  designRate: 0.0341,
  kickbackRateType1: 0.55,
  kickbackRateType2: 0.35,
  corporateTaxRate: 0.17,
  directorSalaryMonthly: 15000000,
  numTechnicians: 1,
  technicianSalaryMonthly: 15000000,
  accountantSalaryMonthly: 3000000,
  officeRentMonthly: 3000000,
  travelEntertainMonthly: 5000000,
  otherCostMonthly: 3000000,
  insuranceRate: 0.215,
  vatRate: 0.08,
  signingCostRateType1: 0.05,
  signingCostRateType2: 0.02,
  fixedCostDeductibleRate: 0.8,
  maxWageFundRate: 0.15,
};

interface FinancialContextType {
  input: FinancialInput;
  setInput: React.Dispatch<React.SetStateAction<FinancialInput>>;
  result: FinancialResult | null;
  setResult: React.Dispatch<React.SetStateAction<FinancialResult | null>>;
  lastUpdated: Date | null;
  setLastUpdated: React.Dispatch<React.SetStateAction<Date | null>>;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export function FinancialProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = usePersistentState<FinancialInput>("ntl.financial.input", DEFAULT_INPUT);
  const [result, setResult] = useState<FinancialResult | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  return (
    <FinancialContext.Provider value={{ input, setInput, result, setResult, lastUpdated, setLastUpdated }}>
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error("useFinancial must be used within a FinancialProvider");
  }
  return context;
}
