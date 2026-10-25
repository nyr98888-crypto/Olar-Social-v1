import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth/session";
import { YonaWorkspace } from "@/components/YonaWorkspace";

export default async function HomePage() {
  const session = await getAppSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <YonaWorkspace
      guestMode={session.mode === "guest"}
      user={{
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
      }}
    />
  );
}
