"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseEther, Address } from "viem";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { RecipientRow, Recipient } from "./RecipientRow";
import { TransactionPreview } from "./TransactionPreview";
import { TransactionStatus } from "./TransactionStatus";
import { useOptimisticTransactions } from "./hooks/useOptimisticTransactions";

export const MultiSendTool = () => {
  const { address: connectedAddress } = useAccount();
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: "1", address: "", amount: "" },
    { id: "2", address: "", amount: "" },
    { id: "3", address: "", amount: "" },
    { id: "4", address: "", amount: "" },
    { id: "5", address: "", amount: "" },
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const {
    optimisticTransactions,
    previewTransaction,
    addOptimisticTransaction,
    updateTransactionStatus,
    removeTransaction,
    updatePreview,
    clearOldTransactions,
  } = useOptimisticTransactions();

  // Contract interactions
  const { data: totalTransactions } = useScaffoldReadContract({
    contractName: "multi-sender",
    functionName: "totalTransactions",
  });

  const { data: totalRecipients } = useScaffoldReadContract({
    contractName: "multi-sender",
    functionName: "totalRecipients",
  });

  const { data: userTransactionCount } = useScaffoldReadContract({
    contractName: "multi-sender",
    functionName: "userTransactionCount",
    args: [connectedAddress],
  });

  const { writeContractAsync: batchSendEth, isMining } = useScaffoldWriteContract("multi-sender");

  // Clear old transactions on mount
  useEffect(() => {
    clearOldTransactions();
  }, [clearOldTransactions]);

  // Calculate total amount
  const calculateTotalAmount = useCallback(() => {
    return recipients.reduce((total, recipient) => {
      const amount = parseFloat(recipient.amount) || 0;
      return total + amount;
    }, 0);
  }, [recipients]);

  // Add recipient
  const addRecipient = () => {
    const newId = Date.now().toString();
    setRecipients(prev => [...prev, { id: newId, address: "", amount: "" }]);
  };

  // Remove recipient
  const removeRecipient = (id: string) => {
    if (recipients.length > 1) {
      setRecipients(prev => prev.filter(r => r.id !== id));
    }
  };

  // Update recipient
  const updateRecipient = (id: string, field: "address" | "amount", value: string) => {
    setRecipients(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // Validate recipients
  const validateRecipients = () => {
    const validRecipients = recipients.filter(
      r => r.address && r.amount && parseFloat(r.amount) > 0 && r.address.length === 42 && r.address.startsWith("0x"),
    );

    if (validRecipients.length === 0) {
      notification.error("Please add at least one valid recipient");
      return null;
    }

    if (validRecipients.length < 5) {
      notification.warning("Challenge requires sending to 5+ addresses, but transaction will proceed");
    }

    return validRecipients;
  };

  // Calculate gas estimate
  const calculateGasEstimate = (validCount: number) => {
    const individualGasCost = validCount * 21000;
    const batchGasCost = 21000 + validCount * 23000;
    const savings = individualGasCost - batchGasCost;
    const savingsPercent = ((savings / individualGasCost) * 100).toFixed(1);

    return {
      individual: individualGasCost,
      batch: batchGasCost,
      savings,
      savingsPercent,
    };
  };

  // Prepare transaction preview
  const prepareTransaction = () => {
    const validRecipients = validateRecipients();
    if (!validRecipients) return;

    setIsValidating(true);

    try {
      const addresses = validRecipients.map(r => r.address as Address);
      const amounts = validRecipients.map(r => parseEther(r.amount));
      const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0n);
      const gasEstimate = calculateGasEstimate(validRecipients.length);

      updatePreview({
        addresses,
        amounts,
        totalAmount,
        gasEstimate,
      });

      setShowPreview(true);
    } catch (error) {
      console.error("Error preparing transaction:", error);
      notification.error("Error preparing transaction preview");
    } finally {
      setIsValidating(false);
    }
  };

  // Execute batch send with optimistic updates
  const executeBatchSend = async () => {
    if (!connectedAddress || !previewTransaction) {
      notification.error("Please connect your wallet and prepare the transaction");
      return;
    }

    // Add optimistic transaction immediately
    const optimisticId = addOptimisticTransaction(
      previewTransaction.addresses,
      previewTransaction.amounts,
      previewTransaction.totalAmount,
    );

    setShowPreview(false);
    notification.info(`Transaction submitted! Tracking progress...`);

    try {
      const txResult = await batchSendEth({
        functionName: "batchSendEth",
        args: [previewTransaction.addresses, previewTransaction.amounts],
        value: previewTransaction.totalAmount,
      });

      // Update optimistic transaction with success
      updateTransactionStatus(optimisticId, "confirmed", txResult);
      notification.success(`Successfully sent to ${previewTransaction.addresses.length} recipients!`);

      // Reset form after successful transaction
      setRecipients([
        { id: "1", address: "", amount: "" },
        { id: "2", address: "", amount: "" },
        { id: "3", address: "", amount: "" },
        { id: "4", address: "", amount: "" },
        { id: "5", address: "", amount: "" },
      ]);
      updatePreview(null);
    } catch (error: any) {
      console.error("Batch send failed:", error);
      // Update optimistic transaction with failure
      updateTransactionStatus(optimisticId, "failed", undefined, error.message || "Transaction failed");
      notification.error(`Transaction failed: ${error.message || "Unknown error"}`);
    }
  };

  const totalAmount = calculateTotalAmount();
  const validRecipientCount = recipients.filter(
    r => r.address && r.amount && parseFloat(r.amount) > 0 && r.address.length === 42 && r.address.startsWith("0x"),
  ).length;

  if (showPreview && previewTransaction) {
    return (
      <div className="flex flex-col gap-6">
        <TransactionPreview
          recipientCount={previewTransaction.addresses.length}
          totalAmount={previewTransaction.totalAmount}
          gasEstimate={previewTransaction.gasEstimate}
          onConfirm={executeBatchSend}
          onCancel={() => setShowPreview(false)}
          isLoading={isMining}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Optimistic Transaction History */}
      {optimisticTransactions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
          <div className="space-y-3">
            {optimisticTransactions.slice(0, 5).map(tx => (
              <TransactionStatus
                key={tx.id}
                id={tx.id}
                timestamp={tx.timestamp}
                addresses={tx.addresses}
                amounts={tx.amounts}
                totalAmount={tx.totalAmount}
                status={tx.status}
                txHash={tx.txHash}
                error={tx.error}
                onRemove={removeTransaction}
              />
            ))}
          </div>
        </div>
      )}

      {/* Statistics Card */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-primary">Contract Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat">
              <div className="stat-title">Total Transactions</div>
              <div className="stat-value text-2xl">{totalTransactions?.toString() || "0"}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Total Recipients Served</div>
              <div className="stat-value text-2xl">{totalRecipients?.toString() || "0"}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Your Transactions</div>
              <div className="stat-value text-2xl">{userTransactionCount?.toString() || "0"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Transfer Form */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-primary">Batch ETH Transfer</h2>

          {/* Recipients List */}
          <div className="space-y-4">
            {recipients.map((recipient, index) => (
              <RecipientRow
                key={recipient.id}
                recipient={recipient}
                index={index}
                onUpdate={updateRecipient}
                onRemove={removeRecipient}
                canRemove={recipients.length > 1}
                isValidating={isValidating}
              />
            ))}
          </div>

          {/* Add Recipient Button */}
          <div className="flex justify-center mt-4">
            <button
              className="btn btn-outline btn-primary"
              onClick={addRecipient}
              disabled={recipients.length >= 20 || isValidating}
            >
              + Add Recipient
            </button>
          </div>

          {/* Live Summary */}
          {(totalAmount > 0 || validRecipientCount > 0) && (
            <div className="mt-6 p-4 bg-info/10 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Live Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm opacity-70">Valid Recipients</p>
                  <p className="text-xl font-bold">{validRecipientCount}</p>
                </div>
                <div>
                  <p className="text-sm opacity-70">Total Amount</p>
                  <p className="text-xl font-bold">{totalAmount.toFixed(4)} ETH</p>
                </div>
                {validRecipientCount > 0 && (
                  <div>
                    <p className="text-sm opacity-70">Est. Gas Savings</p>
                    <p className="text-xl font-bold text-success">
                      ~{calculateGasEstimate(validRecipientCount).savingsPercent}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="card-actions justify-end mt-6">
            <button
              className={`btn btn-primary btn-lg ${isValidating ? "loading" : ""}`}
              onClick={prepareTransaction}
              disabled={!connectedAddress || totalAmount === 0 || validRecipientCount === 0 || isValidating}
            >
              {isValidating
                ? "Validating..."
                : `Review Transaction (${validRecipientCount} recipients, ${totalAmount.toFixed(4)} ETH)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
