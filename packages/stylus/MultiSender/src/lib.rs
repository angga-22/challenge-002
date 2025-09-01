//!
//! MultiSender Contract in Stylus Rust
//!
//! A smart contract for efficiently sending tokens/ETH to multiple recipients in a single transaction.
//! Supports batch transfers with individual amounts per recipient.
//!
//! Features:
//! - Batch ETH transfers
//! - Batch ERC20 token transfers
//! - Gas optimization through single transaction
//! - Safety checks and event emission
//! - Owner-only emergency functions
//!
//! Note: this code is a template-only and has not been audited.
//!

// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

/// Import items from the SDK. The prelude contains common traits and macros.
use stylus_sdk::{
    alloy_primitives::{Address, U256},
    alloy_sol_types::sol,
    prelude::*,
    stylus_core::log,
};

/// Import OpenZeppelin Ownable functionality
use openzeppelin_stylus::access::ownable::{self, IOwnable, Ownable};

/// Error types for the contract
#[derive(SolidityError, Debug)]
pub enum Error {
    UnauthorizedAccount(ownable::OwnableUnauthorizedAccount),
    InvalidOwner(ownable::OwnableInvalidOwner),
    ArrayLengthMismatch,
    InsufficientBalance,
    TransferFailed,
    InvalidRecipient,
    InvalidAmount,
}

impl From<ownable::Error> for Error {
    fn from(value: ownable::Error) -> Self {
        match value {
            ownable::Error::UnauthorizedAccount(e) => Error::UnauthorizedAccount(e),
            ownable::Error::InvalidOwner(e) => Error::InvalidOwner(e),
        }
    }
}

// Define events for batch transfers
sol! {
    event BatchEthTransfer(address indexed sender, uint256 totalAmount, uint256 recipientCount);
    event BatchTokenTransfer(address indexed sender, address indexed token, uint256 totalAmount, uint256 recipientCount);
    event TransferSuccess(address indexed recipient, uint256 amount);
    event TransferFailed(address indexed recipient, uint256 amount, string reason);
}

// ERC20 interface for token transfers
sol! {
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
        function allowance(address owner, address spender) external view returns (uint256);
    }
}

// Define persistent storage using the Solidity ABI.
// `MultiSender` will be the entrypoint.
sol_storage! {
    #[entrypoint]
    pub struct MultiSender {
        Ownable ownable;
        uint256 total_transactions;
        uint256 total_recipients;
        mapping(address => uint256) user_transaction_count;
    }
}

/// Declare that `MultiSender` is a contract with the following external methods.
#[public]
#[implements(IOwnable<Error = Error>)]
impl MultiSender {
    #[constructor]
    pub fn constructor(&mut self, initial_owner: Address) -> Result<(), Error> {
        // Initialize Ownable with the initial owner
        self.ownable.constructor(initial_owner)?;
        self.total_transactions.set(U256::ZERO);
        self.total_recipients.set(U256::ZERO);
        Ok(())
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
    ) -> Result<(), Error> {
        // Validate input arrays
        if recipients.len() != amounts.len() {
            return Err(Error::ArrayLengthMismatch);
        }

        if recipients.is_empty() {
            return Err(Error::InvalidRecipient);
        }

        let sender = self.vm().msg_sender();
        let msg_value = self.vm().msg_value();
        
        // Calculate total amount needed
        let mut total_amount = U256::ZERO;
        for amount in &amounts {
            if *amount == U256::ZERO {
                return Err(Error::InvalidAmount);
            }
            total_amount += *amount;
        }

        // Check if sent value covers total amount
        if msg_value < total_amount {
            return Err(Error::InsufficientBalance);
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

        Ok(())
    }

    /// Batch send ERC20 tokens to multiple recipients
    pub fn batch_send_token(
        &mut self,
        token: Address,
        recipients: Vec<Address>,
        amounts: Vec<U256>,
    ) -> Result<(), Error> {
        // Validate input arrays
        if recipients.len() != amounts.len() {
            return Err(Error::ArrayLengthMismatch);
        }

        if recipients.is_empty() {
            return Err(Error::InvalidRecipient);
        }

        if token == Address::ZERO {
            return Err(Error::InvalidRecipient);
        }

        let sender = self.vm().msg_sender();
        
        // Calculate total amount needed
        let mut total_amount = U256::ZERO;
        for amount in &amounts {
            if *amount == U256::ZERO {
                return Err(Error::InvalidAmount);
            }
            total_amount += *amount;
        }

        // Perform transfers using transferFrom
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

            // Call transferFrom on the token contract
            let transfer_call = IERC20::transferFromCall {
                from: sender,
                to: recipient,
                amount: amounts[i],
            };

            match self.vm().call_contract(token, &transfer_call.abi_encode()) {
                Ok(result) => {
                    // Decode the result to check if transfer was successful
                    if let Ok(success) = bool::abi_decode(&result, true) {
                        if success {
                            successful_transfers += 1;
                            log(self.vm(), TransferSuccess {
                                recipient,
                                amount: amounts[i],
                            });
                        } else {
                            log(self.vm(), TransferFailed {
                                recipient,
                                amount: amounts[i],
                                reason: "Token transfer returned false".to_string(),
                            });
                        }
                    } else {
                        log(self.vm(), TransferFailed {
                            recipient,
                            amount: amounts[i],
                            reason: "Failed to decode transfer result".to_string(),
                        });
                    }
                }
                Err(_) => {
                    log(self.vm(), TransferFailed {
                        recipient,
                        amount: amounts[i],
                        reason: "Token contract call failed".to_string(),
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
        log(self.vm(), BatchTokenTransfer {
            sender,
            token,
            totalAmount: total_amount,
            recipientCount: U256::from(successful_transfers),
        });

        Ok(())
    }

    /// Emergency withdraw function (owner only)
    pub fn emergency_withdraw(&mut self) -> Result<(), Error> {
        self.ownable.only_owner()?;
        
        let balance = self.vm().balance(self.vm().contract_address());
        if balance > U256::ZERO {
            let owner = self.ownable.owner();
            let _ = self.vm().transfer_eth(owner, balance);
        }

        Ok(())
    }

    /// Get estimated gas for batch ETH transfer
    pub fn estimate_batch_eth_gas(&self, recipient_count: U256) -> U256 {
        // Base gas cost + per-recipient cost
        // These are rough estimates and may vary
        let base_gas = U256::from(21000); // Base transaction cost
        let per_recipient_gas = U256::from(23000); // Gas per ETH transfer
        
        base_gas + (per_recipient_gas * recipient_count)
    }

    /// Get estimated gas for batch token transfer
    pub fn estimate_batch_token_gas(&self, recipient_count: U256) -> U256 {
        // Base gas cost + per-recipient cost for token transfers
        let base_gas = U256::from(21000);
        let per_recipient_gas = U256::from(65000); // Gas per token transfer (higher due to ERC20 calls)
        
        base_gas + (per_recipient_gas * recipient_count)
    }

    /// Allow contract to receive ETH
    #[payable]
    pub fn receive_ether(&self) {
        // This function allows the contract to receive ETH
    }
}

/// Implementation of the IOwnable interface
#[public]
impl IOwnable for MultiSender {
    type Error = Error;

    fn owner(&self) -> Address {
        self.ownable.owner()
    }

    fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), Self::Error> {
        Ok(self.ownable.transfer_ownership(new_owner)?)
    }

    fn renounce_ownership(&mut self) -> Result<(), Self::Error> {
        Ok(self.ownable.renounce_ownership()?)
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
        let _ = contract.constructor(owner_addr);

        assert_eq!(contract.owner(), owner_addr);
        assert_eq!(contract.total_transactions(), U256::ZERO);
        assert_eq!(contract.total_recipients(), U256::ZERO);

        // Test gas estimation
        let gas_estimate = contract.estimate_batch_eth_gas(U256::from(5));
        assert!(gas_estimate > U256::ZERO);

        let token_gas_estimate = contract.estimate_batch_token_gas(U256::from(3));
        assert!(token_gas_estimate > gas_estimate);
    }
}
