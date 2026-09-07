import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  redirect("/signin");
}
