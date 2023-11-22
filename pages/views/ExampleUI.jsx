import React from "react";
import { useEffect, useState, useContext } from "react";
import RebalancerWidget from "./Rebalancer";
import PortfolioMetaTab from "./PortfolioMetaTab";
import {
  Row,
  Col,
  ConfigProvider,
  Button,
} from "antd";
import Link from "next/link";
import { web3Context } from "./Web3DataProvider";
import { useWindowHeight } from "../../utils/chartUtils";
import styles from "../../styles/Home.module.css";

export default function ExampleUI() {
  const windowHeight = useWindowHeight();
  const WEB3_CONTEXT = useContext(web3Context);
  const [loadingState, setLoadingState] = useState(true);
  const [portfolioApr, setPortfolioApr] = useState(0);
  const [isHover, setIsHover] = useState(false);

   const handleMouseEnter = () => {
      setIsHover(true);
   };

   const handleMouseLeave = () => {
      setIsHover(false);
   };

  useEffect(() => {
    async function fetchPortfolioMetadata() {
      if (WEB3_CONTEXT !== undefined) {
        setLoadingState(false);
        setPortfolioApr(
          WEB3_CONTEXT.portfolioApr === undefined
            ? 0
            : WEB3_CONTEXT.portfolioApr,
        );
      }
    }
    fetchPortfolioMetadata();
  }, [WEB3_CONTEXT, portfolioApr]);
  return (
    <div className={styles.divInstallment}>
      <Row 
        gutter={{ 
          xs: 8,
          md: 16
        }}
      >
        <Col 
          xs={{
            span: 24,
            offset: 0,
          }}
          md={{
            span: 20,
            offset: 2,
          }}
          className={styles.bgStyle}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: windowHeight
            }}
          >
            <center>
              <h1
                style={{ 
                  marginBottom: '32px',
                  color: '#beed54' 
                }}
                className="heading-title"
              >
                All Weather Protocol
              </h1>
              <h1 className="heading-subtitle">Biggest Liquidity Mining Index Fund</h1>
              <h2 className="heading-subtitle">Click Once, Retire Forever.</h2>
              <p>Reward APR {portfolioApr.toFixed(2)}%</p>
              <ConfigProvider
                theme={{
                  token: {
                    colorPrimary: '#beed54',
                    colorPrimaryBorder: '#beed54',
                  }
                }}
              >
                <Link href="#zapSection">
                  <Button
                    type="primary"
                    loading={loadingState}
                    className={styles.btnInvest}
                    style={
                      isHover
                      ? {backgroundColor: '#beed54', color: '#000000'}
                      : {backgroundColor: 'transparent', color: '#beed54'}
                    }
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    Invest Now!
                  </Button>
                </Link>
              </ConfigProvider>
            </center>
          </div>
        </Col>
        <Col
          xs={{
            span: 24,
            offset: 0,
          }}
          md={{
            span: 18,
            offset: 3,
          }}
        >
          <center>
            <PortfolioMetaTab />
          </center>
          
        </Col>
        <Col
          xs={{
            span: 24,
            offset: 0,
          }}
          md={{
            span: 10,
            offset: 7,
          }}
        >
          <RebalancerWidget />
        </Col>
      </Row>
    </div>
  );
}
