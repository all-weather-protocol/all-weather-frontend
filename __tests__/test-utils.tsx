import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import "@rainbow-me/rainbowkit/styles.css";
import "../styles/index.scss";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
<<<<<<< HEAD
import { configureChains, createConfig, WagmiConfig } from "wagmi";
import { arbitrum, bsc, bscTestnet, goerli } from "wagmi/chains";
import { publicProvider } from "wagmi/providers/public";
import type { AppProps } from "next/app";

import ThirdPartyPlugin from "../pages/thirdPartyPlugin.jsx";
=======
import { WagmiProvider, http } from "wagmi";
import { bscTestnet, bsc, arbitrum } from "wagmi/chains";
import {
  rainbowWallet,
  metaMaskWallet,
  walletConnectWallet,
  rabbyWallet,
} from "@rainbow-me/rainbowkit/wallets";
>>>>>>> main

const config = getDefaultConfig({
  appName: "RainbowKit demo",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "",
  chains: [bsc, arbitrum, bscTestnet],
  transports: {
    [bsc.id]: http(),
    [arbitrum.id]: http(),
    [bscTestnet.id]: http(),
  },
  wallets: [
    {
      groupName: "Suggested",
      wallets: [
        rainbowWallet,
        metaMaskWallet,
        walletConnectWallet,
        rabbyWallet,
      ],
    },
  ],
});

const queryClient = new QueryClient();

const MyApp = ({ children }) => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => render(ui, { wrapper: MyApp, ...options });

export * from "@testing-library/react";
export { customRender as render };
