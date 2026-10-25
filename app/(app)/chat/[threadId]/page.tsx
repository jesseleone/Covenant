"use client";

import { useParams } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";

export default function ChatThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  return <ChatView threadId={threadId} />;
}
