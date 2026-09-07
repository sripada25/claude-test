import { connection } from "next/server";
import { SignInScreen } from "@/components/auth/SignInScreen";

export default async function SignInPage() {
  await connection();
  return <SignInScreen />;
}
