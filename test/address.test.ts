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
