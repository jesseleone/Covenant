"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";

export default function ChatPage() {
  return <Suspense><Chat /></Suspense>;
}

/** /chat?q=… (from the command palette) starts a conversation with that question. */
function Chat() {
  const q = useSearchParams().get("q") ?? undefined;
  return <ChatView initialPrompt={q} />;
}
