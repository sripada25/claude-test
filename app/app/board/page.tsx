import { cookies } from "next/headers";
import { BoardScreen } from "@/components/board/BoardScreen";
import type { BoardView } from "@/components/board/ViewToggle";

function parseCollapsedStages(raw: string | undefined): string[] {
  if (!raw) {
    return ["rejected"];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string")
      ? parsed
      : ["rejected"];
  } catch {
    return ["rejected"];
  }
}

export default async function BoardPage() {
  const cookieStore = await cookies();
  const initialView: BoardView = cookieStore.get("board_view")?.value === "list" ? "list" : "board";
  const initialCollapsedStages = parseCollapsedStages(cookieStore.get("board_collapsed")?.value);

  return <BoardScreen initialView={initialView} initialCollapsedStages={initialCollapsedStages} />;
}
