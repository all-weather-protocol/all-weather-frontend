import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Menu, ConfigProvider } from "antd";

const items = [
  {
    label: <Link href="/">Portfolio</Link>,
    key: "portfolio",
  },
  {
    label: "Analytics",
    key: "analytics",
    children: [
      {
        label: (
          <a
            href="https://debank.com/profile/0x9ad45d46e2a2ca19bbb5d5a50df319225ad60e0d"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vault - DeBank
          </a>
        ),
        key: "setting:1",
      },
      {
        label: (
          <a
            href="https://dune.com/davidtnfsh/all-weather-protocol"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dune Analytics
          </a>
        ),
        key: "setting:2",
      },
      {
        label: <Link href="/betterPools">Better Pools</Link>,
        key: "setting:3",
      },
      {
        label: <Link href="/dashboard">Dashboard</Link>,
        key: "setting:4",
      },
      {
        label: <Link href="/installment">Installment</Link>,
        key: "installment",
      },
    ],
  },
  {
    label: (
      <a
        href="https://all-weather.gitbook.io/all-weather-protocol/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Docs
      </a>
    ),
    key: "docs",
  },
];
export default function NavBar({ mode }) {
  const router = useRouter();
  const [current, setCurrent] = useState(router.pathname);
  const onClick = (e) => {
    setCurrent(e.key);
  };
  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            darkItemBg: "transparent",
            darkItemColor: "#999999",
            darkItemHoverColor: "#ffffff",
            darkSubMenuItemBg: "#222222",
          },
        },
        token: {
          colorPrimary: "transparent",
        },
      }}
    >
      <Menu
        theme="dark"
        onClick={onClick}
        selectable={false}
        selectedKeys={[current]}
        mode={mode}
        items={items}
        style={{ minWidth: 300, flex: "auto" }}
      />
    </ConfigProvider>
  );
}
