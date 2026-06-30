import { expect, test, vi } from "vitest";
import { makeWallet, type Runner } from "../src/wallet.js";

const cfg = { walletBin: "nw", grpcPort: 5556, nicksPerNock: 65536 };

test("treasuryNicks parses the show-balance summary and uses the private gRPC", async () => {
  const run = vi.fn<Runner>(async () =>
    "Wallet Balance\n- Number of Notes: 3\n- Balance: 196608000 nicks\n"
  );
  const w = makeWallet({ ...cfg, run });
  expect(await w.treasuryNicks()).toBe(196608000);
  expect(run.mock.calls[0][1]).toEqual([
    "--client", "private", "--private-grpc-server-port", "5556", "show-balance",
  ]);
});

test("send creates then broadcasts a tx and returns the txid", async () => {
  const run = vi.fn<Runner>(async (_bin, args) => {
    if (args.includes("create-tx")) return "transaction written to ./txs/tx1.tx\n";
    if (args.includes("send-tx")) return "broadcast ok, txid: abc123\n";
    return "";
  });
  const w = makeWallet({ ...cfg, run });
  const txid = await w.send("destPkh", 1000);
  expect(txid).toBe("abc123");

  const create = run.mock.calls.find((c) => c[1].includes("create-tx"))![1];
  expect(create).toContain("--recipient");
  expect(create).toContain("destPkh:65536000"); // 1000 NOCK expressed in nicks
  expect(create).toContain("--private-grpc-server-port");

  const broadcast = run.mock.calls.find((c) => c[1].includes("send-tx"))![1];
  expect(broadcast).toContain("./txs/tx1.tx"); // the file create-tx produced
});

test("watchAddress registers the pkh with the node", async () => {
  const run = vi.fn<Runner>(async () => "Imported watch-only address\n");
  const w = makeWallet({ ...cfg, run });
  await w.watchAddress("pkh1");
  expect(run.mock.calls[0][1]).toEqual([
    "--client", "private", "--private-grpc-server-port", "5556", "watch", "address", "pkh1",
  ]);
});

test("treasuryNicks rejects when the balance cannot be parsed", async () => {
  const run = vi.fn<Runner>(async () => "no balance line here\n");
  const w = makeWallet({ ...cfg, run });
  await expect(w.treasuryNicks()).rejects.toThrow();
});

test("send rejects when the txid cannot be parsed", async () => {
  const run = vi.fn<Runner>(async (_bin, args) =>
    args.includes("create-tx") ? "written to ./txs/x.tx\n" : "unexpected output\n"
  );
  const w = makeWallet({ ...cfg, run });
  await expect(w.send("d", 1000)).rejects.toThrow();
});
