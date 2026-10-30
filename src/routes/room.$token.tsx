import { createFileRoute } from "@tanstack/react-router";
import { RoomView } from "@/components/room-view";

export const Route = createFileRoute("/room/$token")({
  head: () => ({
    meta: [
      { title: "Deal room — Bridgeway" },
      { name: "description", content: "Your requests, title items, messages and shared files for this transaction." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Deal room — Bridgeway" },
      { property: "og:description", content: "Your requests, title items, messages and shared files for this transaction." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { token } = Route.useParams();
  return <RoomView access={{ token }} />;
}
