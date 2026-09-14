import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tautos. Aplink pasaulį per 360 minučių",
  description: "Lapkričio 7 d. Klaipėdos vakarėlis Priekulės kultūros centre.",
};

export default function PartyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
