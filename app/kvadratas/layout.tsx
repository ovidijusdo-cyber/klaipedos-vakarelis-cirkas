import { redirect } from "next/navigation";
import { EVENT_ACCESS } from "../../lib/event-access";

export default function KvadratasLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!EVENT_ACCESS.kvadratas) redirect("/");
  return children;
}
