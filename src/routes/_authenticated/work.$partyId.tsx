import { createFileRoute } from "@tanstack/react-router";
import { RoomView } from "@/components/room-view";

export const Route = createFileRoute("/_authenticated/work/$partyId")({
  head: () => ({ meta: [
    { title: "Deal room — Bridgeway" },
    { name: "description", content: "Requests, deadlines and messages for one of your deals." },
    { property: "og:title", content: "Deal room — Bridgeway" },
    { property: "og:description", content: "Requests, deadlines and messages for one of your deals." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <RoomView access={{ partyId: Route.useParams().partyId }} />,
});
