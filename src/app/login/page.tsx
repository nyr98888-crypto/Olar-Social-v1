import { redirect } from "next/navigation";

/** Auth bypassed in prototype — always land on the app. */
export default function LoginPage() {
  redirect("/");
}
