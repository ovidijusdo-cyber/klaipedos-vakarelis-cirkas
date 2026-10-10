import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kelionė į filialą Suomijoje | Klaipėdos JW renginiai",
  description: "Susidomėjimo registracija planuojamai 2027 m. balandžio kelionei autobusu iš Klaipėdos į Suomiją.",
};

export default function FilialasLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
