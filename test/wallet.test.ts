import { expect, test, vi } from "vitest";
import { makeWallet, type Runner } from "../src/wallet.js";

test("send builds args and returns parsed txid", async () => {
  const run = vi.fn<Runner>(async () => "txid: abc123\n");
  const w = makeWallet({ walletBin: "nw", nodeSocket: "s.sock", faucetPkh: "pk", nicksPerNock: 65536, run });
  const txid = await w.send("dest1", 1000);
  expect(txid).toBe("abc123");
  const [bin, args] = run.mock.calls[0];
  expect(bin).toBe("nw");
  expect(args).toContain("dest1");
  expect(args).toContain("1000");
});

test("treasuryNicks parses total", async () => {
  const run = vi.fn(async () => "total: 54591488 nicks\n");
  const w = makeWallet({ walletBin: "nw", nodeSocket: "s.sock", faucetPkh: "pk", nicksPerNock: 65536, run });
  expect(await w.treasuryNicks()).toBe(54591488);
});

test("send rejects when txid cannot be parsed", async () => {
  const run = vi.fn(async () => "unexpected output\n");
  const w = makeWallet({ walletBin: "nw", nodeSocket: "s.sock", faucetPkh: "pk", nicksPerNock: 65536, run });
  await expect(w.send("dest1", 1000)).rejects.toThrow();
});

test("treasuryNicks rejects when balance cannot be parsed", async () => {
  const run = vi.fn(async () => "no number here\n");
  const w = makeWallet({ walletBin: "nw", nodeSocket: "s.sock", faucetPkh: "pk", nicksPerNock: 65536, run });
  await expect(w.treasuryNicks()).rejects.toThrow();
});
