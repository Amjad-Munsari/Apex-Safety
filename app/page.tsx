import { redirect } from "next/navigation";

export default function Home() {
  if (process.env.NEXT_PUBLIC_DEMO_BYPASS === "1") {
    redirect("/admin");
  }
  redirect("/login");
}
