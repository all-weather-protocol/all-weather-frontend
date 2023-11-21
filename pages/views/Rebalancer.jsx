// import suggestions from "./suggestions.json";
import { Spin, Row, Col } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import RebalanceChart from "./RebalanceChart";
import ZapInButton from "./ZapInButton";
import ZapOutButton from "./ZapOutButton";
import APRPopOver from "./APRPopOver";
import UserBalanceInfo from "./UserBalanceInfo";
import { useWindowWidth } from "../../utils/chartUtils";
import { useEffect, useContext, useState } from "react";
import { web3Context } from "./Web3DataProvider";

const RebalancerWidget = () => {
  const WEB3_CONTEXT = useContext(web3Context);
  const [portfolioApr, setPortfolioApr] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState([]);
  const [totalInterest, setTotalInterest] = useState(0);
  useEffect(() => {
    async function fetchPortfolioMetadata() {
      if (WEB3_CONTEXT !== undefined) {
        setPortfolioApr(WEB3_CONTEXT.portfolioApr);
        setNetWorth(WEB3_CONTEXT.netWorth);
        setRebalanceSuggestions(WEB3_CONTEXT.rebalanceSuggestions);
        setTotalInterest(WEB3_CONTEXT.totalInterest);
      }
    }
    fetchPortfolioMetadata();
  }, [WEB3_CONTEXT]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (netWorth > 0) {
      setIsLoading(false);
    }
  }, [netWorth]);

  const windowWidth = useWindowWidth();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "15rem",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <Row
        gutter={{ 
          xs: 8,
          md: 16
        }} 
        align="center"
      >
        <Col
          md={12}
          xs={24}
          align="center"
        >
          <RebalanceChart
            rebalanceSuggestions={rebalanceSuggestions}
            netWorth={netWorth}
            windowWidth={windowWidth}
            showCategory={false}
          />
          <div>
            <div style={{ marginBottom: 10 }}>
              <text style={{ color: "#BEED54", fontSize: 12 }}>
                Current Strategy: Permanent Portfolio
              </text>
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong style={{ color: "white", fontSize: 26 }}>
                TVL: ${netWorth.toFixed(2)}{" "}
                <a
                  href="https://debank.com/bundles/136612/portfolio"
                  target="_blank"
                >
                  <LinkOutlined />
                </a>
              </strong>
              <div style={{ color: "white" }}>Data updated 5mins ago</div>
            </div>
            <div
              style={{ marginBottom: 10 }}
              id="zapSection"
            >
              <strong style={{ color: "white", fontSize: 26 }}>
                <text>
                  Reward APR: {portfolioApr ? portfolioApr.toFixed(2) : 0}%{" "}
                  <APRPopOver mode="percentage" />
                </text>
              </strong>
            </div>
            <UserBalanceInfo tvl={netWorth} />
            <div style={{ marginBottom: 20 }}>
              <text style={{ color: "white", fontSize: 12 }}>
                Monthly Interest: ${(totalInterest / 12).toFixed(2)}
              </text>
            </div>
            <div>
              <ZapInButton />
              <ZapOutButton />
              <APRPopOver mode="price" />
            </div>
          </div>
        </Col>
      </Row>
    </>
  );
};

export default RebalancerWidget;
