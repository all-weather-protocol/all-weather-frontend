import React, { useState, useEffect, useContext } from "react";
import Image from "next/image";
import { Popover, Tag, Spin, ConfigProvider } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { web3Context } from "./Web3DataProvider";
import ClaimButton from "./ClaimButton";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import TokenTable from "./components/TokenTable.jsx";

const BigNumber = require("bignumber.js");

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const APRPopOver = ({ mode }) => {
  const { connector: isConnected } = useAccount();
  const { chain } = useAccount();

  const [claimableRewards, setClaimableRewards] = useState([]);
  const [aprComposition, setAprComposition] = useState({});
  const [sumOfRewardsDenominatedInUSD, setSumOfRewardsDenominatedInUSD] =
    useState(0);
  const WEB3_CONTEXT = useContext(web3Context);

  useEffect(() => {
    async function fetchData() {
      const claimableRewards = WEB3_CONTEXT.dataOfGetClaimableRewards;
      const claimableRewardsWithChainInfo =
        addChainInfoToToken(claimableRewards);
      setClaimableRewards(claimableRewardsWithChainInfo);
      if (claimableRewardsWithChainInfo === undefined) return;
      const sumOfRewardsDenominatedInUSD_ =
        claimableRewardsWithChainInfo.reduce((total, reward) => {
          return (
            total +
            reward.claimableRewards.reduce((innerTotal, claimableReward) => {
              return innerTotal + turnReward2Price(claimableReward);
            }, 0)
          );
        }, 0);
      setSumOfRewardsDenominatedInUSD(sumOfRewardsDenominatedInUSD_);
    }

    function addChainInfoToToken(claimableRewards) {
      if (claimableRewards === undefined) return;
      for (const reward of claimableRewards) {
        for (const claimableReward of reward.claimableRewards) {
          if (!claimableReward.token.startsWith(chain.network)) {
            claimableReward.token = `${chain.network}:${claimableReward.token}`;
          }
        }
      }
      return claimableRewards;
    }

    async function fetchAprComposition() {
      fetch(
        `${API_URL}/apr_composition?portfolio_name=stablecoin_vault&worksheet=bsc_contract`,
      )
        .then((response) => response.json())
        .then((result) => setAprComposition(result))
        .catch((error) => console.error("Error of apr_composition:", error));
    }
    if (!WEB3_CONTEXT) return;
    fetchData();
    fetchAprComposition();
  }, [WEB3_CONTEXT]);

  function renderContent() {
    if (!WEB3_CONTEXT || Object.keys(aprComposition).length === 0)
      return (
        <center>
          <Spin size="small" />
          Loading (13s)
        </center>
      );
    return (
      <ul>
        {Object.entries(aprComposition["aggregated_apr_composition"])
          .sort((a, b) => b[1].APR - a[1].APR)
          .map(([rewardKey, metadata], idx) => {
            return (
              <RewardItem
                key={`aggregated_apr_composition-${rewardKey}-${idx}`}
                protocol="aggregated_apr_composition"
                rewardKey={rewardKey}
                value={metadata}
              />
            );
          })}
      </ul>
    );
  }

  const RewardItem = ({ protocol, rewardKey, value }) => {
    const renderImageAndAPR = (tokenAddr) => (
      <>
        <Image
          src={WEB3_CONTEXT["debankContext"][tokenAddr].img}
          width={20}
          height={20}
          alt={rewardKey}
        />
        {WEB3_CONTEXT["debankContext"][tokenAddr].symbol}:{" "}
        {(value["APR"] * 100).toFixed(2)}%
      </>
    );

    const renderToken = () => {
      for (const tokenAddr of value["token"]) {
        if (WEB3_CONTEXT["debankContext"].hasOwnProperty(tokenAddr)) {
          return renderImageAndAPR(tokenAddr);
        }
      }
    };

    const renderReward = () => {
      if (rewardKey === "Swap Fee" || rewardKey === "Underlying APY") {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <Image
              src="https://icons-for-free.com/iconfiles/png/512/currency+dollar+money+icon-1320085755803367648.png"
              width={20}
              height={20}
              alt={rewardKey}
              style={{ marginRight: "5px" }}
            />
            {`${rewardKey}: ${(value["APR"] * 100).toFixed(2)}%`}
          </div>
        );
      } else if (WEB3_CONTEXT["debankContext"].hasOwnProperty(value["token"])) {
        return renderImageAndAPR(value["token"]);
      }
    };

    return <li key={`${protocol}-${rewardKey}`}>{renderReward()}</li>;
  };

  function calculateClaimableRewards() {
    // Early return if conditions are not met
    if (!WEB3_CONTEXT || claimableRewards === undefined) return [];
    // Flatten and map claimable rewards to include price
    const claimableRewardsWithPrice = claimableRewards.flatMap((reward) =>
      reward.claimableRewards.map((claimableReward) => {
        const tokenInLowerCase = claimableReward.token.toLowerCase();
        return {
          token: WEB3_CONTEXT["debankContext"][tokenInLowerCase],
          amount: new BigNumber(claimableReward.amount)
            .div(BigInt(10 ** _getDecimalPerToken(tokenInLowerCase)))
            .toString(),
          value: turnReward2Price(claimableReward),
        };
      }),
    );

    // Initialize an empty object to hold aggregated claimable rewards
    const aggregatedClaimableRewards = {};

    // Loop through each claimable reward to aggregate them
    for (const { token, amount, value } of claimableRewardsWithPrice) {
      // Skip if the amount is '0.0'
      if (amount === "0.0" || amount === "0" || token === undefined) continue;
      const tokenSymbol = token.symbol;

      // Initialize if the token does not exist in the aggregated object
      if (!aggregatedClaimableRewards.hasOwnProperty(tokenSymbol)) {
        aggregatedClaimableRewards[tokenSymbol] = { token, amount, value };
      } else {
        // Update the aggregated amount and value for the token
        aggregatedClaimableRewards[tokenSymbol].amount = (
          parseFloat(aggregatedClaimableRewards[tokenSymbol].amount) +
          parseFloat(amount)
        ).toString();

        aggregatedClaimableRewards[tokenSymbol].value += value;
      }
    }

    // Convert the aggregated object to an array and sort it by value
    return Object.values(aggregatedClaimableRewards)
      .sort((a, b) => b.value - a.value)
      .map(({ token, amount, value }) => ({ token, amount, value }));
  }

  const getColumnsForSuggestionsTable = [
    {
      title: "Token",
      dataIndex: "token",
      key: "token",
      width: 24,
      render: (tokenInfo) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <Image
            src={tokenInfo.img}
            width={20}
            height={20}
            alt={tokenInfo.symbol}
          />
          <span
            style={{
              marginLeft: 10,
              color: "#ffffff",
            }}
          >
            {tokenInfo.symbol}
          </span>
        </div>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 24,
      render: (amount) => <span style={{ color: "#ffffff" }}>{amount}</span>,
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      width: 24,
      render: (price) => <Tag color="geekblue">${price.toFixed(2)}</Tag>,
    },
  ];
  const turnReward2Price = (claimableReward) => {
    const tokenInLowerCase = claimableReward.token.toLowerCase();
    const priceAsFloat =
      WEB3_CONTEXT["debankContext"][tokenInLowerCase] !== undefined
        ? WEB3_CONTEXT["debankContext"][tokenInLowerCase].price
        : 0;

    // Use BigNumber from 'bignumber.js' to multiply the price by 10^18
    const priceBigNumber = new BigNumber(priceAsFloat).times(
      new BigNumber(10).pow(18),
    );
    // Convert the result to a string
    const priceAsString = priceBigNumber.toFixed();

    // Convert to an ethers BigNumber
    const priceInBigNumber = ethers.BigNumber.from(priceAsString);

    // Multiply price with amount (both as ethers BigNumbers)
    const resultInBigNumber = priceInBigNumber.mul(claimableReward.amount);
    // Divide by 10^18 to get the final result
    const finalResult = ethers.utils.formatEther(resultInBigNumber);
    if (finalResult > 0) {
      return parseFloat(
        new BigNumber(Math.floor(finalResult)).div(
          BigInt(10 ** _getDecimalPerToken(tokenInLowerCase)),
        ),
      );
    }
    return 0;
  };

  const _getDecimalPerToken = (token) => {
    if (
      [
        "arb:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        "arb:0xd69d402d1bdb9a2b8c3d88d98b9ceaf9e4cd72d9",
        "arb:0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
        "arb:0x48a29e756cc1c097388f3b2f3b570ed270423b3d",
      ].includes(token)
    ) {
      return 6;
    } else if (
      [
        "arb:0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
        "arb:0x727354712bdfcd8596a3852fd2065b3c34f4f770",
      ].includes(token)
    ) {
      return 8;
    }
    return 18;
  };

  if (mode === "percentage") {
    return (
      <Popover
        style={{ width: "500px" }}
        content={renderContent()}
        title="Projected APR"
        trigger="hover"
      >
        <InfoCircleOutlined />
      </Popover>
    );
  } else {
    return (
      <div
        style={{
          margin: "20px 0",
        }}
      >
        <p
          style={{
            fontWeight: 500,
          }}
        >
          Claimable Rewards: ${sumOfRewardsDenominatedInUSD.toFixed(2)}
        </p>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#5DFDCB",
              colorTextLightSolid: "#000000",
            },
          }}
        >
          <ClaimButton />
        </ConfigProvider>
        {isConnected ? (
          <div
            style={{
              marginTop: 10,
            }}
          >
            <TokenTable
              columns={getColumnsForSuggestionsTable}
              dataSource={calculateClaimableRewards()}
              pagination={false}
            />
          </div>
        ) : (
          ""
        )}
      </div>
    );
  }
};

export default APRPopOver;
