import axios from "axios";
import { isLocalEnvironment } from "./environment";

const ERROR_MESSAGES = {
  REJECTED_TRANSACTION: "Transaction was rejected by the user",
  INSUFFICIENT_FUNDS: "Insufficient funds for transaction",
  SLIPPAGE_TOO_HIGH: "Price impact too high, try reducing the amount",
  NETWORK_ERROR: "Network error occurred. Please try again",
  DEFAULT: "An error occurred. Please try again",
};

const ERROR_CODES = {
  "0x495d907f": "bridgequote expired, please try again",
  "0x203d82d8": "DeFi pool quote has expired. Please try again.",
  "0x6f6dd725": "Swap quote has expired. Please try again.",
  "0xf4059071": "Please increase slippage tolerance",
  "0x8f66ec14": "The zap in amount is too small, or slippage is too low",
  "0x09bde339": "Failed to claim rewards, please try again",
  // Hex-encoded error messages
  "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002c4552433732313a206f70657261746f7220717565727920666f72206e6f6e6578697374656e7420746f6b656e0000000000000000000000000000000000000000":
    "ERC721: operator query for nonexistent token",
  "2845524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e6365":
    "ERC20: transfer amount exceeds allowance",
  "45524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e6365":
    "ERC20: transfer amount exceeds balance",
  "526563656976656420616d6f756e74206f6620746f6b656e7320617265206c657373207468656e206578706563746564":
    "Received amount of tokens are less then expected, please increase slippage tolerance and try again",
  "0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000014c00000000000000000000000000000000000000000000000000000000000000":
    "Received amount of tokens are less then expected, please increase slippage tolerance and try again",
};

/**
 * Maps blockchain errors to user-friendly messages
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
const mapErrorToUserFriendlyMessage = (error) => {
  const errorMessage = error.message?.toLowerCase() || "";

  // Check for error codes in the message
  for (const [code, message] of Object.entries(ERROR_CODES)) {
    if (errorMessage.includes(code.toLowerCase())) {
      return message;
    }
  }

  // Special case for '0x' at the end
  if (errorMessage.endsWith("0x")) {
    return "You send the transaction to the wrong address";
  }

  if (
    errorMessage.includes("user rejected") ||
    errorMessage.includes("user denied")
  ) {
    return ERROR_MESSAGES.REJECTED_TRANSACTION;
  }

  if (errorMessage.includes("insufficient funds")) {
    return ERROR_MESSAGES.INSUFFICIENT_FUNDS;
  }

  if (
    errorMessage.includes("slippage") ||
    errorMessage.includes("price impact")
  ) {
    return ERROR_MESSAGES.SLIPPAGE_TOO_HIGH + " " + errorMessage;
  }

  if (
    errorMessage.includes("network error") ||
    errorMessage.includes("network request failed")
  ) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Return both default message and original error for debugging
  return `${error.message || "No error message"}`;
};

/**
 * Logs transaction errors to Discord webhook if not in local environment
 * @param {Error} error - The error object
 */
const logErrorToDiscord = async (error) => {
  if (isLocalEnvironment) return;

  try {
    await axios.post(`${process.env.NEXT_PUBLIC_SDK_API_URL}/discord/webhook`, {
      errorMsg: `<@&1172000757764075580> ${error.message || error.toString()}`,
    });
  } catch (webhookError) {
    console.error("Failed to log error to Discord:", webhookError);
  }
};

/**
 * Main error handler for transactions
 * @param {Error} error - The error object
 * @param {Function} notificationAPI - Notification function to display messages
 * @returns {string} User-friendly error message
 */
export const handleTransactionError = async (error, notificationAPI) => {
  const userMessage = mapErrorToUserFriendlyMessage(error);

  // Log error to Discord in production
  await logErrorToDiscord(error);

  // Show error notification if notification API is provided
  if (notificationAPI) {
    notificationAPI.error({
      message: "Transaction Failed",
      description: userMessage,
    });
  }

  return userMessage;
};

/**
 * Format blockchain error messages for display
 * @param {string} message - Raw error message
 * @returns {string} Formatted error message
 */
export const formatErrorMessage = (message) => {
  if (!message) return ERROR_MESSAGES.DEFAULT;

  // Remove technical details and blockchain-specific prefixes
  return message
    .replace(/\{.*?\}/g, "") // Remove JSON-like content
    .replace(/\[.*?\]/g, "") // Remove bracketed content
    .replace(/^Error:?\s*/i, "") // Remove 'Error:' prefix
    .trim();
};

export { mapErrorToUserFriendlyMessage };
