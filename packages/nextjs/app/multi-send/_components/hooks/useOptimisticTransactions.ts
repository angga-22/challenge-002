import { useState, useCallback } from "react";
import { Address } from "viem";

export interface OptimisticTransaction {
  id: string;
  timestamp: number;
  addresses: Address[];
  amounts: bigint[];
  totalAmount: bigint;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  error?: string;
}

export interface TransactionPreview {
  addresses: Address[];
  amounts: bigint[];
  totalAmount: bigint;
  gasEstimate: {
    individual: number;
    batch: number;
    savings: number;
    savingsPercent: string;
  };
}

export const useOptimisticTransactions = () => {
  const [optimisticTransactions, setOptimisticTransactions] = useState<OptimisticTransaction[]>([]);
  const [previewTransaction, setPreviewTransaction] = useState<TransactionPreview | null>(null);

  const addOptimisticTransaction = useCallback(
    (addresses: Address[], amounts: bigint[], totalAmount: bigint): string => {
      const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const transaction: OptimisticTransaction = {
        id,
        timestamp: Date.now(),
        addresses,
        amounts,
        totalAmount,
        status: "pending",
      };

      setOptimisticTransactions(prev => [transaction, ...prev]);
      return id;
    },
    [],
  );

  const updateTransactionStatus = useCallback(
    (id: string, status: OptimisticTransaction["status"], txHash?: string, error?: string) => {
      setOptimisticTransactions(prev => prev.map(tx => (tx.id === id ? { ...tx, status, txHash, error } : tx)));
    },
    [],
  );

  const removeTransaction = useCallback((id: string) => {
    setOptimisticTransactions(prev => prev.filter(tx => tx.id !== id));
  }, []);

  const updatePreview = useCallback((preview: TransactionPreview | null) => {
    setPreviewTransaction(preview);
  }, []);

  const clearOldTransactions = useCallback(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    setOptimisticTransactions(prev => prev.filter(tx => tx.timestamp > oneHourAgo && tx.status === "pending"));
  }, []);

  return {
    optimisticTransactions,
    previewTransaction,
    addOptimisticTransaction,
    updateTransactionStatus,
    removeTransaction,
    updatePreview,
    clearOldTransactions,
  };
};
