import { expect, test } from "vitest";
import { normalizeIp } from "../src/ip.js";

test("leaves plain IPv4 unchanged", () => {
  expect(normalizeIp("1.2.3.4")).toBe("1.2.3.4");
});

test("unwraps IPv4-mapped IPv6", () => {
  expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
});

test("truncates IPv6 to its /64 prefix", () => {
  expect(normalizeIp("2001:db8:0:0:1:2:3:4")).toBe("2001:0db8:0000:0000");
  expect(normalizeIp("2001:db8::1")).toBe("2001:0db8:0000:0000");
});

test("collapses two addresses in the same /64 to one key", () => {
  expect(normalizeIp("2001:db8::dead")).toBe(normalizeIp("2001:db8::beef"));
});

test("strips an IPv6 zone id", () => {
  expect(normalizeIp("fe80::1%eth0")).toBe("fe80:0000:0000:0000");
});
