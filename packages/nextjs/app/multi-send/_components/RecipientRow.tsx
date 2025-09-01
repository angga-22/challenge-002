import React from "react";
import { AddressInput } from "~~/components/scaffold-eth/Input/AddressInput";
import { EtherInput } from "~~/components/scaffold-eth/Input/EtherInput";

export interface Recipient {
  id: string;
  address: string;
  amount: string;
}

interface RecipientRowProps {
  recipient: Recipient;
  index: number;
  onUpdate: (id: string, field: "address" | "amount", value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  isValidating?: boolean;
}

export const RecipientRow: React.FC<RecipientRowProps> = ({
  recipient,
  index,
  onUpdate,
  onRemove,
  canRemove,
  isValidating = false,
}) => {
  const isValidAddress = recipient.address.length === 42 && recipient.address.startsWith("0x");
  const isValidAmount = recipient.amount && parseFloat(recipient.amount) > 0;
  const isComplete = isValidAddress && isValidAmount;

  return (
    <div
      className={`flex gap-4 items-center p-4 rounded-lg transition-all duration-200 ${
        isComplete
          ? "bg-success/10 border border-success/20"
          : recipient.address || recipient.amount
            ? "bg-warning/10 border border-warning/20"
            : "bg-base-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold w-8">#{index + 1}</span>
        {isComplete && <span className="text-success text-sm">✓</span>}
      </div>

      <div className="flex-1">
        <AddressInput
          placeholder="Recipient address (0x...)"
          value={recipient.address}
          onChange={value => onUpdate(recipient.id, "address", value)}
          disabled={isValidating}
        />
        {recipient.address && !isValidAddress && <p className="text-error text-xs mt-1">Invalid address format</p>}
      </div>

      <div className="w-48">
        <EtherInput
          placeholder="0.1"
          value={recipient.amount}
          onChange={value => onUpdate(recipient.id, "amount", value)}
          disabled={isValidating}
        />
        {recipient.amount && !isValidAmount && <p className="text-error text-xs mt-1">Amount must be greater than 0</p>}
      </div>

      {canRemove && (
        <button
          className="btn btn-sm btn-error btn-outline"
          onClick={() => onRemove(recipient.id)}
          disabled={isValidating}
          title="Remove recipient"
        >
          ✕
        </button>
      )}
    </div>
  );
};
