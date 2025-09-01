//!
//! MultiSender Contract in Stylus Rust
//!
//! A smart contract for efficiently sending tokens/ETH to multiple recipients in a single transaction.
//! Supports batch transfers with individual amounts per recipient.
//!
//! Features:
//! - Batch ETH transfers
//! - Gas optimization through single transaction
//! - Safety checks and event emission
//! - Basic access control
//!
//! Note: this code is a template-only and has not been audited.
//!

// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::string::{String, ToString};
use alloc::vec::Vec;

/// Import items from the SDK. The prelude contains common traits and macros.
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    alloy_sol_types::sol,
    prelude::*,
    stylus_core::log,
};

// Define events for batch transfers
sol! {
    event BatchEthTransfer(address indexed sender, uint256 totalAmount, uint256 recipientCount);
    event BatchTokenTransfer(address indexed sender, address indexed token, uint256 totalAmount, uint256 recipientCount);
    event TransferSuccess(address indexed recipient, uint256 amount);
    event TransferFailed(address indexed recipient, uint256 amount, string reason);
}

// Define persistent storage using the Solidity ABI.
// `MultiSender` will be the entrypoint.
sol_storage! {
    #[entrypoint]
    pub struct MultiSender {
        address owner;
        uint256 total_transactions;
        uint256 total_recipients;
        mapping(address => uint256) user_transaction_count;
    }
}

/// Declare that `MultiSender` is a contract with the following external methods.
#[public]
impl MultiSender {
    #[constructor]
    pub fn constructor(&mut self, initial_owner: Address) {
        self.owner.set(initial_owner);
        self.total_transactions.set(U256::ZERO);
        self.total_recipients.set(U256::ZERO);
    }

    /// Get the contract owner
    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    /// Get total number of batch transactions processed
    pub fn total_transactions(&self) -> U256 {
        self.total_transactions.get()
    }

    /// Get total number of recipients served
    pub fn total_recipients(&self) -> U256 {
        self.total_recipients.get()
    }

    /// Get transaction count for a specific user
    pub fn user_transaction_count(&self, user: Address) -> U256 {
        self.user_transaction_count.get(user)
    }

    /// Batch send ETH to multiple recipients
    #[payable]
    pub fn batch_send_eth(
        &mut self,
        recipients: Vec<Address>,
        amounts: Vec<U256>,
    ) {
        // Validate input arrays
        if recipients.len() != amounts.len() {
            return;
        }

        if recipients.is_empty() {
            return;
        }

        let sender = self.vm().msg_sender();
        let msg_value = self.vm().msg_value();
        
        // Calculate total amount needed
        let mut total_amount = U256::ZERO;
        for amount in &amounts {
            if *amount == U256::ZERO {
                return;
            }
            total_amount += *amount;
        }

        // Check if sent value covers total amount
        if msg_value < total_amount {
            return;
        }

        // Perform transfers
        let mut successful_transfers = 0u32;
        for (i, &recipient) in recipients.iter().enumerate() {
            if recipient == Address::ZERO {
                log(self.vm(), TransferFailed {
                    recipient,
                    amount: amounts[i],
                    reason: "Invalid recipient address".to_string(),
                });
                continue;
            }

            // Attempt transfer
            match self.vm().transfer_eth(recipient, amounts[i]) {
                Ok(_) => {
                    successful_transfers += 1;
                    log(self.vm(), TransferSuccess {
                        recipient,
                        amount: amounts[i],
                    });
                }
                Err(_) => {
                    log(self.vm(), TransferFailed {
                        recipient,
                        amount: amounts[i],
                        reason: "Transfer failed".to_string(),
                    });
                }
            }
        }

        // Update statistics
        let current_total_tx = self.total_transactions.get();
        self.total_transactions.set(current_total_tx + U256::from(1));
        
        let current_total_recipients = self.total_recipients.get();
        self.total_recipients.set(current_total_recipients + U256::from(successful_transfers));
        
        let current_user_count = self.user_transaction_count.get(sender);
        self.user_transaction_count.insert(sender, current_user_count + U256::from(1));

        // Emit batch transfer event
        log(self.vm(), BatchEthTransfer {
            sender,
            totalAmount: total_amount,
            recipientCount: U256::from(successful_transfers),
        });

        // Return excess ETH if any
        let excess = msg_value - total_amount;
        if excess > U256::ZERO {
            let _ = self.vm().transfer_eth(sender, excess);
        }
    }

    /// Emergency withdraw function (owner only)
    pub fn emergency_withdraw(&mut self) {
        let caller = self.vm().msg_sender();
        let owner = self.owner.get();
        
        if caller != owner {
            return;
        }
        
        let balance = self.vm().balance(self.vm().contract_address());
        if balance > U256::ZERO {
            let _ = self.vm().transfer_eth(owner, balance);
        }
    }

    /// Transfer ownership to a new owner (owner only)
    pub fn transfer_ownership(&mut self, new_owner: Address) {
        let caller = self.vm().msg_sender();
        let owner = self.owner.get();
        
        if caller != owner || new_owner == Address::ZERO {
            return;
        }
        
        self.owner.set(new_owner);
    }

    /// Get estimated gas for batch ETH transfer
    pub fn estimate_batch_eth_gas(&self, recipient_count: U256) -> U256 {
        // Base gas cost + per-recipient cost
        // These are rough estimates and may vary
        let base_gas = U256::from(21000); // Base transaction cost
        let per_recipient_gas = U256::from(23000); // Gas per ETH transfer
        
        base_gas + (per_recipient_gas * recipient_count)
    }

    /// Allow contract to receive ETH
    #[payable]
    pub fn receive_ether(&self) {
        // This function allows the contract to receive ETH
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use stylus_sdk::testing::*;

    #[no_mangle]
    pub unsafe extern "C" fn emit_log(_pointer: *const u8, _len: usize, _: usize) {}
    #[no_mangle]
    pub unsafe extern "C" fn msg_sender(_sender: *mut u8) {}

    #[test]
    fn test_multisender() {
        let vm = TestVM::default();
        let mut contract = MultiSender::from(&vm);

        // Test initialization
        let owner_addr = Address::from([1u8; 20]);
        contract.constructor(owner_addr);

        assert_eq!(contract.owner(), owner_addr);
        assert_eq!(contract.total_transactions(), U256::ZERO);
        assert_eq!(contract.total_recipients(), U256::ZERO);

        // Test gas estimation
        let gas_estimate = contract.estimate_batch_eth_gas(U256::from(5));
        assert!(gas_estimate > U256::ZERO);
    }
}
