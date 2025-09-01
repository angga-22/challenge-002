import React from "react";
import { formatEther } from "viem";

interface TransactionPreviewProps {
  recipientCount: number;
  totalAmount: bigint;
  gasEstimate?: {
    individual: number;
    batch: number;
    savings: number;
    savingsPercent: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TransactionPreview: React.FC<TransactionPreviewProps> = ({
  recipientCount,
  totalAmount,
  gasEstimate,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  return (
    <div className="card bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 shadow-lg">
      <div className="card-body">
        <h3 className="card-title text-primary">
          <span className="text-2xl">🚀</span>
          Ready to Send
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-figure text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-8 h-8 stroke-current"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="stat-title">Recipients</div>
              <div className="stat-value text-primary">{recipientCount}</div>
              <div className="stat-desc">Addresses to receive ETH</div>
            </div>
          </div>

          <div className="stats shadow">
            <div className="stat">
              <div className="stat-figure text-secondary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-8 h-8 stroke-current"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v20m9-9H3" />
                </svg>
              </div>
              <div className="stat-title">Total Amount</div>
              <div className="stat-value text-secondary">{formatEther(totalAmount)}</div>
              <div className="stat-desc">ETH to be sent</div>
            </div>
          </div>
        </div>

        {gasEstimate && (
          <div className="alert alert-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="font-bold">Gas Optimization Active!</h4>
              <div className="text-sm">
                Saving ~{gasEstimate.savingsPercent}% gas ({gasEstimate.savings.toLocaleString()} units) compared to
                individual transactions
              </div>
            </div>
          </div>
        )}

        <div className="card-actions justify-end gap-3 mt-6">
          <button className="btn btn-outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </button>
          <button
            className={`btn btn-primary btn-lg ${isLoading ? "loading" : ""}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : `Send ${formatEther(totalAmount)} ETH`}
          </button>
        </div>
      </div>
    </div>
  );
};
