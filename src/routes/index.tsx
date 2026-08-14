import { createFileRoute } from "@tanstack/react-router";
import { DriftGame } from "@/game/DriftGame";

export const Route = createFileRoute("/")({
  component: Home,
  ssr: false,
});

function Home() {
  return <DriftGame />;
}
