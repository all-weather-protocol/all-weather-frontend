import { test, vi, expect } from "vitest";
import { render } from "./test-utils.tsx";
import { screen, fireEvent } from "@testing-library/react";
import BasePage from "../pages/basePage";

/**
 * @vitest-environment jsdom
 */

const { useRouter, mockedRouterPush } = vi.hoisted(() => {
  const mockedRouterPush = vi.fn();
  return {
    useRouter: () => ({ push: mockedRouterPush }),
    mockedRouterPush,
  };
});

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual("next/navigation");
  return {
    ...actual,
    useRouter,
  };
});

test("BasePage", () => {
  render(<BasePage />);
});

test("Connect Wallet", async () => {
  render(<BasePage />);

  const button = await screen.getAllByRole("button", {
    name: "Connect Wallet",
  });
  fireEvent.click(button[0]);

  // Wait for any asynchronous updates
  const modal = screen.queryByRole("dialog");
  expect(modal).not.toBeNull();
  const metaMaskButton = await screen.getAllByRole("button", {
    name: "Rainbow",
  });
  expect(metaMaskButton).not.toBeNull();
});
