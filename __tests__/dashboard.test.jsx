import { test, vi, expect } from "vitest";
import { render, fireEvent, screen } from "./test-utils";
import Dashboard from "../pages/dashboard";
import { waitFor } from "@testing-library/dom";

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

test("Connect Wallet", async () => {
  // render(<Dashboard />);
  // const ethTokenImgs = await screen.findAllByAltText('eth', {}, { timeout: 3000 })
  // expect(ethTokenImgs.length).toBeGreaterThan(0);
});
