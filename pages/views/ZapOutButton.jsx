import { Button, Space, message, ConfigProvider } from "antd";
import { portfolioContractAddress, USDC } from "../../utils/oneInch";
import NumericInput from "./NumberInput";
import { DollarOutlined } from "@ant-design/icons";
import { useEffect, useState, useContext } from "react";
import {
  useWriteContract,
  useReadContract,
  useAccount,
  useWaitForTransactionReceipt,
} from "wagmi";
import { refreshTVLData } from "../../utils/contractInteractions";
import permanentPortfolioJson from "../../lib/contracts/PermanentPortfolioLPToken.json";
import { web3Context } from "./Web3DataProvider";
import {
  selectBefore,
  getAggregatorData,
} from "../../utils/contractInteractions";

const { ethers } = require("ethers");

const ZapOutButton = () => {
  const { address } = useAccount();
  const WEB3_CONTEXT = useContext(web3Context);
  const normalWording = "Withdraw";
  const loadingWording = "Fetching the best route to withdraw";
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [userShares, setUserShares] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [approveReady, setApproveReady] = useState(true);
  const [approveAmount, setApproveAmount] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [chosenToken, setChosenToken] = useState(
    "0x55d398326f99059fF775485246999027B3197955",
  );
  const [apiDataReady, setApiDataReady] = useState(true);

  const {
    data: redeemData,
    writeContract,
    isPending: redeemDataIsPending,
    status: redeemDataStatus,
  } = useWriteContract();

  const {
    data: approveData,
    writeContract: approveWrite,
    isPending: approveIsPending,
    status: approveStatus,
  } = useWriteContract();

  const {
    data: approveAmountContract,
    error: approveAmountError,
    isPending: approveAmountContractIsPending,
  } = useReadContract({
    address: portfolioContractAddress,
    abi: permanentPortfolioJson.abi,
    functionName: "allowance",
    args: [address, portfolioContractAddress],
    // args: ["0x43cd745Bd5FbFc8CfD79ebC855f949abc79a1E0C", "0x78000b0605E81ea9df54b33f72ebC61B5F5c8077"],
    watch: true,
  });
  const { chain } = useAccount();

  useEffect(() => {
    if (WEB3_CONTEXT) {
      setUserShares(WEB3_CONTEXT.userShares);
    }
    if (approveAmountContractIsPending) return; // Don't proceed if loading
    if (approveAmountError)
      console.log("allowance Error", approveAmountError.message);
    setApproveAmount(approveAmountContract);

    // Approve feedback
    if (approveStatus === "pending") {
      message.loading("Approved loading");
    } else if (approveStatus === "success") {
      message.destroy();
      message.success("Approved success");
    }

    // Withdraw feedback
    if (redeemDataStatus === "pending") {
      message.loading("Withdraw loading");
    } else if (redeemDataStatus === "success") {
      message.destroy();
      message.success("Withdraw success");
    }
  }, [
    WEB3_CONTEXT,
    address,
    approveAmountContractIsPending,
    approveAmountContract,
    approveReady,
    redeemDataIsPending,
    approveStatus,
    redeemDataStatus,
  ]);
  const handleInputChange = async (eventValue) => {
    setInputValue(eventValue);
    if (eventValue !== "") {
      const withdrawAmount_ = eventValue;
      setWithdrawAmount(withdrawAmount_);
    }
    if (approveAmount < eventValue) {
      setApproveReady(false);
    }
  };

  const handleOnClickMax = async () => {
    const withdrawAmount_ = userShares.toString();
    setWithdrawAmount(withdrawAmount_);
    setInputValue(userShares);
    // TODO(david): find a better way to implement.
    // Since `setInputValue` need some time to propagate, the `inputValue` would be 0 at the first click.
    // then be updated to the correct value at the second click.
    if (approveAmount < inputValue || inputValue === 0) {
      setApproveReady(false);
    }
  };

  const handleZapOut = async () => {
    setApiDataReady(false);
    if (approveAmount < inputValue) {
      approveWrite(
        {
          address: portfolioContractAddress,
          abi: permanentPortfolioJson.abi,
          functionName: "approve",
          args: [portfolioContractAddress, ethers.BigNumber.from(inputValue)],
          from: address,
        },
        {
          onError(error) {
            messageApi.error({
              content: error.shortMessage,
              duration: 5,
            });
          },
          async onSuccess() {
            await _callbackAfterApprove();
          },
        },
      );
    } else {
      await _callbackAfterApprove();
    }
  };

  const _callbackAfterApprove = async () => {
    setApproveReady(true);
    // restore this one after know the price of ALP
    // const aggregatorDatas = await getAggregatorData(
    //   chain.id,
    //   inputValue,
    //   USDC,
    //   chosenToken,
    //   portfolioContractAddress,
    //   1,
    // );
    writeContract(
      {
        address: portfolioContractAddress,
        abi: permanentPortfolioJson.abi,
        functionName: "redeem",
        args: [
          {
            amount: withdrawAmount,
            receiver: address,
            apolloXRedeemData: {
              alpTokenOut: chosenToken,
              minOut: withdrawAmount,
              tokenOut: chosenToken,
              aggregatorData: "",
            },
          },
        ],
        from: address,
      },
      {
        onError(error) {
          messageApi.error({
            content: error.shortMessage,
            duration: 5,
          });
        },
        async onSuccess() {
          await refreshTVLData(messageApi);
        },
      },
    );
    setApiDataReady(true);
  };

  return (
    <div>
      {contextHolder}
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#5DFDCB",
            colorTextLightSolid: "#000000",
          },
        }}
      >
        <Space.Compact
          style={{
            margin: "10px 0",
          }}
        >
          {selectBefore(
            (value) => {
              setChosenToken(value);
            },
            "address",
            chain?.id,
          )}
          <NumericInput
            placeholder={`Balance: ${userShares} SCLP`}
            value={inputValue}
            onChange={handleInputChange}
          />
          <Button type="primary" onClick={handleOnClickMax}>
            Max
          </Button>
        </Space.Compact>
        <Button
          loading={!apiDataReady}
          onClick={handleZapOut} // Added onClick handler
          type="primary"
          icon={<DollarOutlined />}
          style={{
            marginTop: 10,
            display: "block",
          }}
        >
          {apiDataReady ? normalWording : loadingWording}
        </Button>
      </ConfigProvider>
    </div>
  );
};

export default ZapOutButton;
