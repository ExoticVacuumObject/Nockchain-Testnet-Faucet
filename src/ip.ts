function expandIpv6(ip: string): string[] | null {
  const parts = ip.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 ? (parts[1] ? parts[1].split(":") : []) : [];
  if (parts.length === 1) {
    if (head.length !== 8) return null;
    return head.map(pad);
  }
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill("0"), ...tail].map(pad);
}

function pad(group: string): string {
  return group.toLowerCase().padStart(4, "0");
}

// Collapse a client address to a stable cooldown key: IPv4-mapped IPv6 becomes plain
// IPv4, and an IPv6 address is reduced to its /64 prefix (a client controls its whole
// /64, so keying on the full address would let it rotate around the cooldown).
export function normalizeIp(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const groups = expandIpv6(ip.split("%")[0]);
  if (!groups) return ip;
  return groups.slice(0, 4).join(":");
}
