import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AddApplicationButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      aria-label="Add application"
      className="size-11 shrink-0 sm:size-auto sm:justify-start"
    >
      <span className="hidden sm:inline">Add application</span>
      <Plus size={16} className="sm:hidden" />
    </Button>
  );
}
