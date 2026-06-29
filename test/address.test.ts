import { expect, test } from "vitest";
import { isValidAddress } from "../src/address.js";

test("accepts a base58 pubkey-shaped string", () => {
  expect(isValidAddress("9WzHyhnanLweqrPJe3KzKNsU8srmzjkXE2oiKZpV1BecK3XuPXS3Ges")).toBe(true);
});

test("rejects empty, too short, and non-base58", () => {
  expect(isValidAddress("")).toBe(false);
  expect(isValidAddress("abc")).toBe(false);
  expect(isValidAddress("0OIl_not_base58_0OIl_not_base58_0OIl_not")).toBe(false);
});

test("accepts a 55-char pkh (the real receive-address length)", () => {
  expect(isValidAddress("9yPePjfWAdUnzaQKyxcRXKRa5PpUzKKEwtpECBZsUYt9Jd7egSDEWoV")).toBe(true);
});

test("enforces the length boundaries", () => {
  const b58 = (n: number) => "1".repeat(n);
  expect(isValidAddress(b58(39))).toBe(false); // just under
  expect(isValidAddress(b58(40))).toBe(true);  // lower bound
  expect(isValidAddress(b58(120))).toBe(true); // upper bound
  expect(isValidAddress(b58(121))).toBe(false); // just over
});
