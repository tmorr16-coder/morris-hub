import { redirect } from "next/navigation";

// Chat is now combined with Search at /bible/search
export default function ChatPage() {
  redirect("/bible/search?tab=ask");
}
