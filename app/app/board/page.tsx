import { cookies } from "next/headers";
import { BoardScreen } from "@/components/board/BoardScreen";
import type { BoardView } from "@/components/board/ViewToggle";

export default async function BoardPage() {
  const cookieStore = await cookies();
  const initialView: BoardView = cookieStore.get("board_view")?.value === "list" ? "list" : "board";

  return <BoardScreen initialView={initialView} />;
}
