import React from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useWindowHeight } from "../../utils/chartUtils";
import styles from "../../styles/Home.module.css";
import { useDispatch, useSelector } from "react-redux";
import { useActiveAccount } from "thirdweb/react";
import Link from "next/link";
import {
  fetchDataStart,
  fetchDataSuccess,
  fetchDataFailure,
} from "../../lib/features/apiSlice";
import { fetchStrategyMetadata } from "../../lib/features/strategyMetadataSlice.js";
import { walletAddressChanged } from "../../lib/features/subscriptionSlice";
import axios from "axios";
import { Spin } from "antd";
import { useRouter } from "next/router";
import Vaults from "../indexes/index.jsx";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ExampleUI() {
  const [isHover, setIsHover] = useState(false);

  const handleMouseEnter = () => {
    setIsHover(true);
  };
  const handleMouseLeave = () => {
    setIsHover(false);
  };

  const windowHeight = useWindowHeight();
  const dispatch = useDispatch();
  const { data, loading } = useSelector((state) => state.api);
  const account = useActiveAccount();
  const walletAddress = account?.address.toLocaleLowerCase();
  const { strategyMetadata, strategyLoading, error } = useSelector(
    (state) => state.strategyMetadata,
  );
  const maxAPREntry = Object.entries(strategyMetadata).reduce(
    (max, [key, strategy]) => {
      const apr = strategy.portfolioAPR * 100;
      return apr > max.apr ? { key, apr } : max;
    },
    { key: "", apr: -Infinity },
  );

  const maxAPR = maxAPREntry.apr.toFixed(2);
  const portfolioName = maxAPREntry.key.replace(" ", "+");
  const router = useRouter();

  const { query } = router;
  const searchWalletAddress = query.address;

  useEffect(() => {
    if (
      strategyMetadata === undefined ||
      Object.keys(strategyMetadata).length === 0
    ) {
      dispatch(fetchStrategyMetadata());
    }
  }, []);
  useEffect(() => {
    if (!walletAddress) return;
    dispatch(walletAddressChanged({ walletAddress: walletAddress }));
  }, [account]);
  useEffect(() => {
    if (!walletAddress && !searchWalletAddress) return;
    fetchBundlePortfolio(false);
  }, [searchWalletAddress, walletAddress]);
  const fetchBundlePortfolio = (refresh) => {
    dispatch(fetchDataStart());
    axios
      .get(
        `${API_URL}/bundle_portfolio/${
          searchWalletAddress === undefined
            ? walletAddress
            : searchWalletAddress.toLowerCase().trim().replace("/", "")
        }?refresh=${refresh}`,
      )
      .then((response) => response.data)
      .then((data) => dispatch(fetchDataSuccess(data)))
      .catch((error) => dispatch(fetchDataFailure(error.toString())));
  };
  return (
    <div className="px-2 text-white bg-black">
      <div className={"w-full md:w-5/6 md:ml-[8.333333%] " + styles.bgStyle}>
        <div
          style={{
            minHeight: windowHeight,
          }}
          className="flex items-center justify-center"
        >
          <center>
            <Image src="/logo.png" alt="logo" width={100} height={100} />
            <h1 className="text-5xl tracking-tight mb-8 text-[#5DFDCB]">
              All Weather Protocol
            </h1>
            <h2 className="heading-subtitle">
              Your Intent Centric Yield Aggregator
            </h2>
            <p className="heading-subtitle">Click Once, Diversify Forever!</p>
            <p className="heading-subtitle">
              Enjoy Up to
              <span
                className="text-5xl tracking-tight text-[#5DFDCB]"
                data-testid="apr"
              >
                {" "}
                {strategyLoading ||
                isNaN(strategyMetadata["Stablecoin Vault"]?.portfolioAPR) ? (
                  <Spin />
                ) : (
                  (
                    strategyMetadata["Stablecoin Vault"]?.portfolioAPR * 100
                  ).toFixed(2)
                )}
                %{" "}
              </span>
              APR
            </p>
            <Link
              href={`/indexes/indexOverviews?portfolioName=Stablecoin+Vault`}
            >
              <button
                type="button"
                className="
                  mt-8 px-4 py-2 w-52 h-12
                  font-semibold bg-transparent text-[#5DFDCB]
                  rounded-md border border-solid border-[#5DFDCB] 
                  hover:bg-[#5DFDCB] hover:text-black
                  transition-colors duration-200
                "
                role="invest_now"
              >
                Invest Now!
              </button>
            </Link>
          </center>
        </div>
      </div>
      <div className="w-full md:w-[75%] md:ml-[12.5%] md:flex items-center">
        <div className="w-full md:w-1/2 px-2">
          <h3 className="text-2xl text-emerald-400 font-semibold mb-4">
            What is All Weather Protocol?
          </h3>
          <p className="text-lg mb-4">
            We help you diversify your investments across various high-yield
            protocols. With just one click, you can increase your returns and
            save time on research and transactions.
          </p>
        </div>
        <div className="w-full md:w-1/2">
          <div className="relative w-full aspect-video">
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src="https://www.youtube.com/embed/wSzdKyqLKdY?si=8nRvJgJ3wYuvS9ew"
              title="YouTube video player"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </div>
      <div className="w-full md:w-[75%] md:ml-[12.5%]">
        <h3 className="text-2xl text-emerald-400 font-semibold md:mb-4 px-4">
          Vaults
        </h3>
        <Vaults />
      </div>
    </div>
  );
}
