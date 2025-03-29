import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/20/solid";

const EmailSubscription = () => {
  const account = useActiveAccount();
  const address = account?.address;
  const [email, setEmail] = useState("");
  const [apiStatus, setApiStatus] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function checkSubscription() {
      if (!address) return;

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SDK_API_URL}/subscriptions?address=${address}`,
        );
        const data = await response.json();
        setIsSubscribed(data.subscriptionStatus === true);
      } catch (error) {
        console.error("Failed to check subscription status:", error);
      }
    }

    checkSubscription();
  }, [address]);

  // If already subscribed, don't show the form
  if (isSubscribed) {
    return null;
  }

  async function handleUnlock() {
    if (email === "" || typeof address === "undefined") {
      setApiStatus("Email and address are required!");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SDK_API_URL}/subscriptions/email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            email,
            subscription: true,
          }),
        },
      );
      const resp = await response.json();
      setApiStatus(resp.status);
    } catch (error) {
      setApiStatus("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  return (
    <>
      {apiStatus === "" ? null : (
        <Alert apiStatus={apiStatus} onDismiss={() => setApiStatus("")} />
      )}
      <form className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-center gap-3">
          <input
            id="email-address"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="flex-1 min-w-0 rounded-lg border-0 bg-[#1a1f2e] px-4 py-2.5 text-white placeholder-gray-400 shadow-sm ring-1 ring-inset ring-gray-700/50 focus:ring-2 focus:ring-inset focus:ring-[#10B981] sm:text-sm"
            placeholder="Enter your email"
            value={email}
            onChange={handleEmailChange}
          />
          <button
            type="button"
            onClick={handleUnlock}
            disabled={isLoading}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Subscribing...
              </>
            ) : (
              "Subscribe to Report"
            )}
          </button>
        </div>
      </form>
    </>
  );
};

const Alert = ({ apiStatus, onDismiss }) => {
  return (
    <div className={`rounded-md bg-green-50 p-4`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <CheckCircleIcon
            className={`h-5 w-5 text-green-400`}
            aria-hidden="true"
          />
        </div>
        <div className="ml-3">
          <p className={`text-sm font-medium text-green-800`}>{apiStatus}</p>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              type="button"
              onClick={onDismiss}
              className={`inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 focus:ring-offset-green-50`}
            >
              <span className="sr-only">Dismiss</span>
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSubscription;
