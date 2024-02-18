import {
  Button,
  Space,
  Modal,
  message,
  Spin,
  ConfigProvider,
  Radio,
} from "antd";
import { EditOutlined } from "@ant-design/icons";
import styles from "../../styles/zapInOut.module.scss";
import { z } from "zod";
import { encodeFunctionData } from "viem";
import { portfolioContractAddress, USDT } from "../../utils/oneInch";
import {
  selectBefore,
  getAggregatorData,
  sleep,
  refreshTVLData,
} from "../../utils/contractInteractions";
import {
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import {
  useWriteContract,
  useBalance,
  useReadContract,
  useAccount,
  useWaitForTransactionReceipt,
} from "wagmi";

import permanentPortfolioJson from "../../lib/contracts/PermanentPortfolioLPToken.json";
import NumericInput from "./NumberInput";
import { ethers } from "ethers";
import { sendDiscordMessage } from "../../utils/discord";
import SlippageModal from "./components/SlippageModal";
const MINIMUM_ZAP_IN_AMOUNT = 0.001;
const MAXIMUM_ZAP_IN_AMOUNT = 1000000;
const depositSchema = z
  .number()
  .min(
    MINIMUM_ZAP_IN_AMOUNT - 0.000000001,
    `The deposit amount should be at least ${MINIMUM_ZAP_IN_AMOUNT}`,
  )
  .max(
    MAXIMUM_ZAP_IN_AMOUNT,
    `The deposit amount should be at most ${MAXIMUM_ZAP_IN_AMOUNT}`,
  );
const fakeAllowanceAddressForBNB = "0x55d398326f99059fF775485246999027B3197955";

const ZapInButton = () => {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const normalWording = "Deposit";
  const loadingWording = "Fetching the best route to deposit";
  const [amount, setAmount] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [alert, setAlert] = useState(false);

  const [apiDataReady, setApiDataReady] = useState(true);
  const [fetchingStatus, setFetchingStatus] = useState("");
  const [approveReady, setApproveReady] = useState(true);
  const [approveAmount, setApproveAmount] = useState(0);
  const [depositHash, setDepositHash] = useState(undefined);
  const [chosenToken, setChosenToken] = useState(
    "0x55d398326f99059fF775485246999027B3197955",
  );
  const [messageApi, contextHolder] = message.useMessage();
  const [slippage, setSlippage] = useState(1);
  const [slippageModalOpen, setSlippageModalOpen] = useState(false);
  const { chain } = useAccount();

  const showModal = () => {
    setOpen(true);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const showSlippageModal = () => {
    setSlippageModalOpen(true);
  };

  const { data: chosenTokenBalance } = useBalance({
    address,
    ...(chosenToken === "0x0000000000000000000000000000000000000000"
      ? {}
      : { token: chosenToken }), // Include token only if chosenToken is truthy
    // token: chosenToken,
    onError(error) {
      console.log(`cannot read ${chosenToken} Balance:`, error);
      throw error;
    },
  });

  const iconSize = { fontSize: "20px" };
  const defaultIcon = {
    width: 20,
    height: 20,
    border: "2px solid #555555",
    borderRadius: "100%",
  };

  const statusIcon = (status) => {
    switch (status) {
      case "error":
        return (
          <ExclamationCircleOutlined
            style={{ ...iconSize, color: "#ff6347" }}
          />
        );
      case "loading":
        return <LoadingOutlined style={{ ...iconSize, color: "#3498db" }} />;
      case "success":
        return (
          <CheckCircleOutlined style={{ ...iconSize, color: "#5dfdcb" }} />
        );
      default:
        return <div style={defaultIcon}></div>;
    }
  };

  const {
    data: approveData,
    writeContract: approveWrite,
    isPending: approveIsPending,
  } = useWriteContract();

  const {
    isLoading: approveIsLoading,
    isSuccess: approveIsSuccess,
    isError: approveIsError,
  } = useWaitForTransactionReceipt({ hash: approveData });

  const { data: depositData, writeContract } = useWriteContract();
  const { status: depositStatus } = useWaitForTransactionReceipt({
    hash: depositData?.hash,
  });

  // const {
  //   data: depositData,
  //   writeContract,
  //   status: depositStatus,
  // } = useCustomContractWrite({
  //   address: portfolioContractAddress,
  //   abi: permanentPortfolioJson.abi,
  //   functionName: "deposit",
  //   onError(error) {
  //     if (
  //       JSON.stringify(error)
  //         .toLocaleLowerCase()
  //         .includes("user rejected the request")
  //     ) {
  //       return;
  //     }
  //     sendDiscordMessage(address, "handleZapin failed!");
  //     messageApi.error({
  //       content: `${error.shortMessage}. Amout: ${error.args[0].amount}. Increase the deposit amount and try again.`,
  //       duration: 5,
  //     });
  //     throw error;
  //   },
  //   onSuccess(data) {
  //     sendDiscordMessage(address, "handleZapin succeeded!");
  //     setDepositHash(data.hash);
  //   },
  // });

  const {
    data: approveAmountData,
    error: approveAmountError,
    isPending: approveAmounIsPending,
  } = useReadContract({
    address:
      chosenToken === "0x0000000000000000000000000000000000000000"
        ? fakeAllowanceAddressForBNB
        : chosenToken,
    abi: permanentPortfolioJson.abi,
    functionName: "allowance",
    args: [address, portfolioContractAddress],
  });

  useEffect(() => {
    if (approveAmounIsPending) return; // Don't proceed if loading
    if (approveAmountError) {
      console.log("allowance Error", approveAmountError.message);
      throw approveAmountError;
    }
    setApproveAmount(approveAmountData);
    if (depositStatus === "success") messageApi.info("Deposit succeeded"); // untill deposit transaction status === "success", then send meessageApi
  }, [approveAmounIsPending, approveAmountData, depositStatus, slippage]);

  const handleInputChange = async (eventValue) => {
    if (eventValue === "") {
      return;
    }
    setInputValue(eventValue);
    let amount_;
    amount_ = ethers.utils.parseEther(eventValue);
    setAmount(amount_);
  };
  const handleOnClickMax = async () => {
    setAmount(chosenTokenBalance.formatted);
    setInputValue(chosenTokenBalance.formatted);
    handleInputChange(chosenTokenBalance.formatted);

    // TODO(david): find a better way to implement.
    // Since `setAmount` need some time to propagate, the `amount` would be 0 at the first click.
    // then be updated to the correct value at the second click.
    if (approveAmount < amount || amount === 0) {
      setApproveReady(false);
    }
  };

  const handleZapIn = async () => {
    await sendDiscordMessage(address, "starts handleZapin()");
    const validationResult = depositSchema.safeParse(Number(inputValue));
    if (!validationResult.success) {
      setAlert(true);
      return;
    }
    await _sendDepositTransaction();
    await _sendEvents();
  };

  const _sendDepositTransaction = async () => {
    setAlert(false);
    showModal();
    let amount_;
    try {
      amount_ = ethers.utils.parseEther(inputValue);
      setAmount(amount_);
    } catch (error) {
      return;
    }
    // check the type of amount and the approveAmount
    if (approveAmountData < amount_) {
      setApiDataReady(false);
      if (
        approveWrite &&
        chosenToken != "0x0000000000000000000000000000000000000000"
      ) {
        approveWrite(
          {
            abi: permanentPortfolioJson.abi,
            address: chosenToken,
            functionName: "approve",
            args: [portfolioContractAddress, amount.toString()],
          },
          {
            onError(error) {
              messageApi.error({
                content: `${error}`,
                duration: 5,
              });
            },
            onSuccess: async (_) => {
              await sleep(5000);
              _callbackAfterApprove();
            },
          },
        );
      }
    } else {
      _callbackAfterApprove();
    }
  };

  const _callbackAfterApprove = async () => {
    setApproveReady(true);
    setFetchingStatus("loading");
    const aggregatorDatas = await getAggregatorData(
      chain.id,
      amount,
      chosenToken,
      USDT,
      portfolioContractAddress,
      slippage,
    );
    const preparedDepositData = _getDepositData(
      amount,
      address,
      chosenToken,
      USDT,
      aggregatorDatas,
    );
    // print out the encoded data for debugging
    const encodedFunctionData = encodeFunctionData({
      abi: permanentPortfolioJson.abi,
      functionName: "deposit",
      args: [preparedDepositData],
    });
    setFetchingStatus("success");
    setApiDataReady(true);
    writeContract({
      abi: permanentPortfolioJson.abi,
      address: portfolioContractAddress,
      functionName: "deposit",
      args: [preparedDepositData],
    });
  };

  const _sendEvents = async () => {
    window.gtag("event", "deposit", {
      amount: parseFloat(amount.toString()),
    });
    await refreshTVLData(messageApi);
  };

  const _getDepositData = (
    amount,
    address,
    tokenIn,
    tokenInAfterSwap,
    aggregatorDatas,
  ) => {
    return {
      amount: ethers.BigNumber.from(amount),
      receiver: address,
      tokenIn,
      tokenInAfterSwap,
      aggregatorData: aggregatorDatas.apolloxAggregatorData,
      apolloXDepositData: {
        tokenIn: tokenInAfterSwap,
        // TODO(david): need to figure out a way to calculate minALP
        minALP: amount.div(2),
      },
    };
  };

  const modalContent = (
    <Modal
      visible={open}
      closeIcon={<> </>}
      onCancel={handleCancel}
      bodyStyle={{ backgroundColor: "black", color: "white" }} // Set background and font color for the body
      wrapClassName="black-modal" // Custom class to style the modal wrapper
      footer={[
        <Button
          key="back"
          onClick={handleCancel}
          style={{
            color: "black",
            backgroundColor: "#5DFDCB",
            borderColor: "#5DFDCB",
          }}
        >
          Return
        </Button>,
      ]}
    >
      <div
        style={{
          border: "2px solid #5dfdcb",
          borderRadius: "1rem",
          padding: "10px", // This creates a margin-like effect for the border
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          {statusIcon(
            approveIsPending || approveIsLoading
              ? "loading"
              : approveIsSuccess
              ? "success"
              : approveIsError
              ? "error"
              : "",
          )}
          <span style={{ marginLeft: 5 }}>Approve</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          {statusIcon(fetchingStatus)}
          <span style={{ marginLeft: 5 }}>Fetching the best route </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          {statusIcon(depositStatus)}
          <span style={{ marginLeft: 5 }}>Deposit </span>
        </div>
        {typeof depositHash === "undefined" ? (
          <div></div>
        ) : (
          <center>
            🚀 Finishied! Check your transaction on the explorer 🚀
            <a
              href={`https://bscscan.com/tx/${depositHash}`}
              target="_blank"
            >{`https://bscscan.com/tx/${depositHash}`}</a>
          </center>
        )}
      </div>
    </Modal>
  );

  return (
    <div>
      {contextHolder}
      {modalContent}
      <SlippageModal
        slippage={slippage}
        setSlippage={setSlippage}
        slippageModalOpen={slippageModalOpen}
        setSlippageModalOpen={setSlippageModalOpen}
      />
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
          {selectBefore((value) => {
            setChosenToken(value);
          })}
          <NumericInput
            placeholder={`Balance: ${
              chosenTokenBalance ? chosenTokenBalance.formatted : 0
            }`}
            value={inputValue}
            onChange={(value) => {
              handleInputChange(value);
            }}
          />
          <Button type="primary" onClick={handleOnClickMax}>
            Max
          </Button>
        </Space.Compact>
        <div className={styles.divSlippage}>
          <p>Max Slippage: {slippage}%</p>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={showSlippageModal}
            className={styles.slippageBtn}
          />
        </div>
        <Button
          loading={!apiDataReady}
          onClick={handleZapIn} // Added onClick handler
          type="primary"
          icon={<DollarOutlined />}
          style={{
            margin: "10px 0",
          }}
        >
          {/* {!approveReady ? approvingWording : apiDataReady ? normalWording : loadingWording} */}
          {apiDataReady ? normalWording : loadingWording}
        </Button>
      </ConfigProvider>
      {alert && (
        // make text color red, and state please enter an amount larger than 0.01
        <div style={{ color: "red" }}>
          Please enter an amount greater than {MINIMUM_ZAP_IN_AMOUNT} and at
          most {MAXIMUM_ZAP_IN_AMOUNT}
        </div>
      )}
    </div>
  );
};

export default ZapInButton;
