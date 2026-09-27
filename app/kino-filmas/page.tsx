import { redirect } from "next/navigation";
import { EVENT_ACCESS } from "../../lib/event-access";
import HomePage from "../page";

export default function MoviePage() {
  if (!EVENT_ACCESS.movie) redirect("/");
  return <HomePage />;
}
