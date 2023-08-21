import React, { createContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import permanentPortfolioJson from "../../lib/contracts/PermanentPortfolioLPToken.json";
import { useContract, useWalletClient } from "wagmi";
import { useContractRead, useContractWrite } from "wagmi";
import { portfolioContractAddress } from "../../utils/oneInch";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const web3Context = createContext();

const Web3DataProvider = ({ children, address }) => {
  const [data, setData] = useState(null);
  const dataOfGetClaimableRewards = useContractRead({
    address: portfolioContractAddress,
    abi: permanentPortfolioJson.abi,
    functionName: "getClaimableRewards",
    args: [address],
    onError(error) {
      console.log("Error", error);
    },
  });
  const userShares = useContractRead({
    address: portfolioContractAddress,
    abi: permanentPortfolioJson.abi,
    functionName: "balanceOf",
    args: [address],
  });
  const totalSupply = useContractRead({
    address: portfolioContractAddress,
    abi: permanentPortfolioJson.abi,
    functionName: "totalSupply",
  });
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
          });
        })
        .catch((error) => console.error("Error:", error));
    }
    fetchData();
  }, []);

  return <web3Context.Provider value={data}>{children}</web3Context.Provider>;
};

export default Web3DataProvider;
