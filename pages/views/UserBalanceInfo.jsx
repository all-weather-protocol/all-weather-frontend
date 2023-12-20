import { useEffect, useState, useContext } from "react";
import { web3Context } from "./Web3DataProvider";
const BigNumber = require("bignumber.js");

const UserBalanceInfo = ({ tvl }) => {
  const WEB3_CONTEXT = useContext(web3Context);
  const [userShares, setUserShares] = useState(0);
  const [totalSupply, setTotalSupply] = useState(1);
  const [portfolioApr, setPortfolioApr] = useState(0);

  useEffect(() => {
    async function fetchSharesInfo() {
      if (WEB3_CONTEXT) {
        setUserShares(
          WEB3_CONTEXT.userShares === undefined ? 0 : WEB3_CONTEXT.userShares,
        );
        setTotalSupply(
          WEB3_CONTEXT.totalSupply === undefined ? 0 : WEB3_CONTEXT.totalSupply,
        );
        setPortfolioApr(
          WEB3_CONTEXT.portfolioApr === undefined
            ? 0
            : WEB3_CONTEXT.portfolioApr,
        );
      }
    }
    fetchSharesInfo();
  }, [WEB3_CONTEXT]);

  const userPercentage = new BigNumber(userShares).div(totalSupply);
  const userDeposit = userPercentage * tvl;

  return (
    <div
      style={{
        marginTop: 20,
        color: "white",
      }}
    >
      <h3>
        Your Deposit: $
        {process.env.NEXT_PUBLIC_DAVID_PORTFOLIO !== "true" ? userDeposit : tvl}
      </h3>
      <b style={{ color: "#555555" }}>
        Your Share: {userPercentage.times(100).toFixed(2)}%
      </b>
      <h3>
        Monthly Interest: $
        {process.env.NEXT_PUBLIC_DAVID_PORTFOLIO !== "true"
          ? ((userDeposit * portfolioApr) / 100 / 12).toFixed(2)
          : ((tvl * portfolioApr) / 100 / 12).toFixed(2)}
      </h3>
    </div>
  );
};

export default UserBalanceInfo;
