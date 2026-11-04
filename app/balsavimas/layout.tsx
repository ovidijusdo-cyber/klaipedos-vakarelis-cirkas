import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vakaro balsavimas | Klaipėdos JW renginiai",
  description: "Vakaro nominacijų balsavimas ir rezultatai.",
  robots: { index: false, follow: false },
};

export default function BallotLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
