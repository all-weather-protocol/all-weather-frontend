import axios from "axios";
import { useState, useEffect } from "react";
import { portfolioVaults } from "./oneInch";
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function useRebalanceSuggestions() {
  const [netWorth, setNetWorth] = useState(0);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState([]);
  const [totalInterest, setTotalInterest] = useState(0);
  const [portfolioApr, setPortfolioApr] = useState(0);
  const [sharpeRatio, setSharpeRatio] = useState({});
  const [ROI, setROI] = useState({});
  const [topNLowestAprPools, setTopNLowestAprPools] = useState([]);
  const [topNPoolConsistOfSameLpToken, setTopNPoolConsistOfSameLpToken] =
    useState([]);
  const [topNStableCoins, setTopNStableCoins] = useState([]);
  const [aggregatedPositions, setAggregatedPosisions] = useState([]);
  const [maxDrawdown, setMaxDrawdown] = useState(0);
  const [claimableRewards, setClaimableRewards] = useState(0);

  // Function to load suggestions from the API
  const loadSuggestions = async () => {
    await axios
      .get(
        `${API_URL}/addresses?addresses=${portfolioVaults.join(
          "+",
        )}&worksheet=bsc_contract`,
      )
      .then((response) => {
        const newNetWorth = response.data.net_worth;
        setNetWorth(newNetWorth);
        const newRebalanceSuggestions = response.data.suggestions;
        setRebalanceSuggestions(newRebalanceSuggestions);
        const portfolioApr = response.data.portfolio_apr;
        setPortfolioApr(portfolioApr);
        const sharpeRatio = response.data.sharpe_ratio;
        setSharpeRatio(sharpeRatio);
        const roi = response.data.ROI;
        setROI(roi);
        const topNLowestAprPools = response.data.top_n_lowest_apr_pools;
        setTopNLowestAprPools(topNLowestAprPools);
        const topNPoolConsistOfSameLpToken =
          response.data.top_n_pool_consist_of_same_lp_token;
        setTopNPoolConsistOfSameLpToken(topNPoolConsistOfSameLpToken);
        const topNStableCoins = response.data.topn_stable_coins;
        setTopNStableCoins(topNStableCoins);

        const aggregatedPositions = response.data.aggregated_positions;
        setAggregatedPosisions(aggregatedPositions);
        const max_drawdown = response.data.max_drawdown;
        setMaxDrawdown(max_drawdown);

        setClaimableRewards(response.data.claimable_rewards);
      })
      .catch((error) => console.log(error));
  };

  // Use useEffect to load suggestions once when the component mounts
  useEffect(() => {
    loadSuggestions();
  }, []);

  return {
    netWorth,
    rebalanceSuggestions,
    totalInterest,
    portfolioApr,
    sharpeRatio,
    topNLowestAprPools,
    topNPoolConsistOfSameLpToken,
    topNStableCoins,
    aggregatedPositions,
    ROI,
    maxDrawdown,
    claimableRewards,
  };
}
