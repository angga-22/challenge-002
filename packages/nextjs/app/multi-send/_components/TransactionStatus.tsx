import React from "react";
import { formatEther, Address } from "viem";

interface TransactionStatusProps {
  id: string;
  timestamp: number;
  addresses: Address[];
  amounts: bigint[];
  totalAmount: bigint;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;
  error?: string;
  onRemove?: (id: string) => void;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  id,
  timestamp,
  addresses,
  totalAmount,
  status,
  txHash,
  error,
  onRemove,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case "pending":
        return <span className="loading loading-spinner loading-sm text-warning"></span>;
      case "confirmed":
        return <span className="text-success text-lg">✓</span>;
      case "failed":
        return <span className="text-error text-lg">✗</span>;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "pending":
        return "border-warning bg-warning/10";
      case "confirmed":
        return "border-success bg-success/10";
      case "failed":
        return "border-error bg-error/10";
      default:
        return "border-base-300";
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className={`card border-2 ${getStatusColor()} shadow-sm`}>
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h4 className="font-semibold">
                {addresses.length} Recipients • {formatEther(totalAmount)} ETH
              </h4>
              <p className="text-sm opacity-70">{formatTime(timestamp)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {txHash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline"
              >
                View
              </a>
            )}
            {onRemove && status !== "pending" && (
              <button className="btn btn-sm btn-ghost" onClick={() => onRemove(id)}>
                ✕
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-2">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {status === "pending" && (
          <div className="mt-2">
            <p className="text-sm opacity-70">Processing transaction...</p>
          </div>
        )}

        {status === "confirmed" && (
          <div className="mt-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="opacity-70">Recipients:</span> {addresses.length}
              </div>
              <div>
                <span className="opacity-70">Total:</span> {formatEther(totalAmount)} ETH
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
