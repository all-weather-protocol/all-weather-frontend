// import suggestions from "./suggestions.json";
import { LinkOutlined, LoadingOutlined } from "@ant-design/icons";
import RebalanceChart from "./RebalanceChart";
import ZapInButton from "./ZapInButton";
import ZapOutButton from "./ZapOutButton";
import UserBalanceInfo from "./UserBalanceInfo";
import { useWindowWidth } from "../../utils/chartUtils";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

const RebalancerWidget = () => {
  const windowWidth = useWindowWidth();
  const { data } = useSelector((state) => state.api);
  const getLoadingDom = () => {
    return (
      <>
        <div className="flex justify-items-center items-center h-24">
          <LoadingOutlined className="mx-auto text-5xl" />
        </div>
        <p className="text-base text-center font-semibold leading-5">
          Loading, please wait...
        </p>
      </>
    );
  };
  const getRebalanceDom = () => {
    console.log("getRebalanceDom", data, data.net_worth);
    return (
      <>
        <div id="zapSection">
          <RebalanceChart
            rebalanceSuggestions={data.suggestions}
            netWorth={data.net_worth}
            windowWidth={windowWidth}
            showCategory={false}
          />
          <div>
            <div>
              <h3>
                {/* TVL: ${data?.netWorthWithCustomLogic}{" "} */}
                TVL: ${data?.net_worth}{" "}
                <a
                  href="https://debank.com/profile/0x9ad45d46e2a2ca19bbb5d5a50df319225ad60e0d"
                  target="_blank"
                >
                  <LinkOutlined />
                </a>
              </h3>
              <h3>
                Reward APR:{" "}
                {data?.portfolioApr ? data?.portfolioApr.toFixed(2) : 0}%{" "}
                {/* <APRPopOver mode="percentage" /> */}
              </h3>
            </div>
            <div>
              <UserBalanceInfo
                netWorth={data?.net_worth}
                netWorthWithCustomLogic={data?.net_worth}
                portfolioApr={data?.portfolio_apr}
                claimableRewards={data?.claimable_rewards}
              />
            </div>
            <div>
              <ZapInButton />
              <ZapOutButton />
              {/* <APRPopOver mode="price" /> */}
            </div>
          </div>
        </div>
      </>
    );
  };
  const [renderContent, setRenderContent] = useState(null);

  useEffect(() => {
    if (data) {
      setRenderContent(getRebalanceDom());
    } else {
      setRenderContent(getLoadingDom());
    }
  }, [data]);

  return renderContent;
};

export default RebalancerWidget;
