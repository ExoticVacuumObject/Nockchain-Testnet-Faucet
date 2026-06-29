export function fundingStatus(args: {
  monthlyDonationNicks: number;
  nicksPerNock: number;
  priceUsd: number;
  monthlyCostUsd: number;
}): { coveredUsd: number; monthlyCostUsd: number; percent: number } {
  const nock = args.monthlyDonationNicks / args.nicksPerNock;
  const coveredUsd = Math.round(nock * args.priceUsd * 100) / 100;
  const percent = Math.min(100, Math.round((coveredUsd / args.monthlyCostUsd) * 100));
  return { coveredUsd, monthlyCostUsd: args.monthlyCostUsd, percent };
}
