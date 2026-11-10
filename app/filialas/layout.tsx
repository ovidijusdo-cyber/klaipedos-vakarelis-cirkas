import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kelionė į filialą Suomijoje | Klaipėdos JW renginiai",
  description: "Preliminari registracija į 2027 m. balandžio 15–17 d. kelionę autobusu iš Klaipėdos į Jehovos liudytojų filialą Suomijoje.",
};

export default function FilialasLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
