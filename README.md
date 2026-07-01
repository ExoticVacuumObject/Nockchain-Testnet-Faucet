# Nock Faucet

A self-hosted faucet that dispenses fakenet $NOCK for Nockchain development.
Node/TypeScript + Fastify + better-sqlite3, single process serving the page and the API.

> **Status: archived.** Built and tested (70 passing) but shelved before the deploy was
> finished. See "Why this is archived" and "Notes on Nockchain" below — the technical notes
> may save other Nockchain developers a lot of time.

## Requirements

- Node 20+
- A running Nockchain fakenet node and `nockchain-wallet` on PATH
- `nockd` running `balance-api` for the donation bar (optional)

## Run

```
cp .env.example .env   # edit values
npm install
npm start
```

## Why this is archived

A faucet turns out to be an Ethereum-shaped answer to a problem Nockchain doesn't have:

- On Nockchain, "testnet" means a **local `--fakenet`** you run yourself. Its genesis is
  deterministic and its coinbase is trivially self-mineable (tens of millions of NOCK in a few
  hours from a single miner), so any developer can fund their own test environment in minutes —
  no faucet required.
- There is no always-on shared public testnet, and the architecture doesn't need one: NockApps
  execute **off-chain** and are sovereign, settling zero-knowledge proofs to the base layer, so
  there's no shared on-chain state for apps to integrate against the way EVM dApps use Sepolia.

The value proposition — hand out scarce testnet tokens on a shared network — doesn't map onto
how Nockchain is actually used. The code is left here as a reference.

## Notes on Nockchain (things that cost us time)

Ground truth is the installed `nockchain-wallet --help` and the Hoon source (`tx-engine.hoon`,
`blockchain_constants.rs`) — third-party guides lag the fast-moving repo, and the old
`--nockchain-socket` model is gone (the current wallet uses gRPC with `--client private|public`).

**Mined coinbase shows as 0 balance → pass `--fakenet` to the wallet.**
The wallet derives a coinbase note's "first-name" from its own blockchain-constants, which
default to **mainnet** (`coinbase_timelock_min`, `v1_phase`, `bythos_phase`). A fakenet node
mines with different constants, so without `--fakenet` the derived name never matches the
on-chain note and every balance/list call returns 0:

```
nockchain-wallet --fakenet --client private --private-grpc-server-port <port> list-notes-by-address <pkh>
```

**Wallet CLI reality:**

- Global flags go **before** the subcommand: `--fakenet --client private --private-grpc-server-port <port>`.
- `--client` defaults to `public` and points at a hardcoded mainnet gRPC — always set
  `--client private` for a local node.
- `show-balance` does **not** count coinbase notes (only simple/spendable). Sum
  `list-notes-by-address-csv` (the `assets` column, in nicks) for a coinbase-funded balance.
- `create-tx`: `--names` is optional (auto-selects v1 notes); prefer `--notes-csv` for
  coinbase-funded sends. v1 notes need no `--refund-pkh`. Recipient is `<pkh>:<nicks>` or a JSON
  object (`p2pkh` / `multisig` / `bridge-deposit`).
- `create-tx` writes the transaction to `./txs/<name>.tx` — **not** printed to stdout; find it as
  the newest file in `./txs/`.
- `send-tx` prints `Validation for TX <txid> passed.`
- Units: 1 NOCK = 65,536 nicks; coinbase reward = 65,536 NOCK per block.

**Operational gotchas:**

- Set `TRACY_NO_INVARIANT_CHECK=1` on virtualized/cloud CPUs or every binary aborts on startup
  (and it isn't sourced by non-interactive shells — export it inline).
- Cap the PMA (`--pma-initial-size`, `--pma-reserved-size`) or it can grow to tens of GB and fill
  the disk.
- Building from source wants swap on an 8 GB box.
- Wallet balance/spend go through the node's **private** gRPC (`--bind-private-grpc-port`); the
  public gRPC returns "not implemented" for balance.

## On-chain capabilities (for anyone deciding what to build)

Nockchain is a zkPoW L1 with a UTXO/"notes" model and **no on-chain smart contracts**. The whole
on-chain scripting surface is three lock types, composable via OR in a Merkle tree:

- `%pkh` — m-of-n multisig (Schnorr, includes 1-of-1)
- `%tim` — timelocks (absolute and relative)
- `%hax` — hash locks (enables HTLCs)

Notes also carry arbitrary key-value `note-data`. Application logic lives **off-chain** in
NockApps (Hoon/Jock kernels); the chain verifies proofs and settles transfers.

## Known limitations

The deploy was never finished, and the `nockchain-wallet` adapter in `src/wallet.ts` predates the
CLI findings above (it omits `--fakenet`, reads balance via `show-balance`, and parses the
tx-file path from stdout) — so it is known to be incorrect against the current wallet. Treat this
repository as a reference, not a working deployment.

## License

MIT
