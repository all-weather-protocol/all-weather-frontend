import React, { createContext, useState, useEffect } from "react";
import permanentPortfolioJson from "../../lib/contracts/PermanentPortfolioLPToken.json";
import { useContractRead } from "wagmi";
import { portfolioContractAddress } from "../../utils/oneInch";
import useRebalanceSuggestions from "../../utils/rebalanceSuggestions";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const web3Context = createContext();

const Web3DataProvider = ({ children, address }) => {
  const [data, setData] = useState({});
  const dataOfGetClaimableRewards = useContractRead({
    address: portfolioContractAddress,
    abi: permanentPortfolioJson.abi,
    functionName: "getClaimableRewards",
    args: [address],
    onError(error) {
      console.log("getClaimableRewards Error", error);
    },
  });
  const userShares = useContractRead({
    address: portfolioContractAddress,
    abi: permanentPortfolioJson.abi,
    functionName: "balanceOf",
    args: [address],
    onError(error) {
      console.log("userShares Error", error);
    },
  });
  const totalSupply = useContractRead({
    address: portfolioContractAddress,
    abi: permanentPortfolioJson.abi,
    functionName: "totalSupply",
    onError(error) {
      console.log("totalSupply Error", error);
    },
  });

  const {
    netWorth,
    rebalanceSuggestions,
    totalInterest,
    portfolioApr,
    aggregatedPositions,
    topNLowestAprPools,
    topNPoolConsistOfSameLpToken,
    topNStableCoins,
  } = useRebalanceSuggestions();

  useEffect(() => {
    async function fetchData() {
      if (
        dataOfGetClaimableRewards.loading === true ||
        userShares.loading === true ||
        totalSupply.loading === true
      )
        return; // Don't proceed if loading
      // Fetch data from API
      fetch(`${API_URL}/debank`)
        .then((response) => response.json())
        .then((result) => {
          setData({
            debankContext: result,
            dataOfGetClaimableRewards: dataOfGetClaimableRewards.data,
            userShares: userShares.data,
            totalSupply: totalSupply.data,
            netWorth,
            rebalanceSuggestions,
            totalInterest,
            portfolioApr,
            aggregatedPositions,
            topNLowestAprPools,
            topNPoolConsistOfSameLpToken,
            topNStableCoins,
          });
        })
        .catch((error) => console.error("Error:", error));
    }
    fetchData();
  }, [
    address,
    dataOfGetClaimableRewards.loading,
    dataOfGetClaimableRewards.data,
    userShares.loading,
    userShares.data,
    totalSupply.loading,
    totalSupply.data,
    portfolioApr,
  ]);

  return <web3Context.Provider value={data}>{children}</web3Context.Provider>;
};

export default Web3DataProvider;
