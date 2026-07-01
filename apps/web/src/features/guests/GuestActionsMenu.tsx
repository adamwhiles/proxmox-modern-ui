import { MoreHorizontal, Play, Square, RotateCw, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDeleteGuest, useGuestAction, type GuestType } from "@/hooks/useGuests";
import { ApiError } from "@/lib/api";

interface Props {
  clusterId: string;
  node: string;
  type: GuestType;
  vmid: number;
  status?: string;
}

export function GuestActionsMenu({ clusterId, node, type, vmid, status }: Props) {
  const action = useGuestAction();
  const del = useDeleteGuest();

  function run(actionName: "start" | "stop" | "shutdown" | "reboot") {
    action.mutate(
      { clusterId, node, type, vmid, action: actionName },
      {
        onSuccess: () => toast.success(`${actionName} requested for ${type} ${vmid}`),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Action failed"),
      },
    );
  }

  function handleDelete() {
    if (!confirm(`Permanently delete ${type} ${vmid} on ${node}? This cannot be undone.`)) return;
    del.mutate(
      { clusterId, node, type, vmid },
      {
        onSuccess: () => toast.success(`Deleted ${type} ${vmid}`),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Delete failed"),
      },
    );
  }

  const isRunning = status === "running";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[10rem] rounded-md border bg-background p-1 shadow-md"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            disabled={isRunning}
            onSelect={() => run("start")}
          >
            <Play className="h-3.5 w-3.5" /> Start
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            disabled={!isRunning}
            onSelect={() => run("shutdown")}
          >
            <Power className="h-3.5 w-3.5" /> Shutdown
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            disabled={!isRunning}
            onSelect={() => run("stop")}
          >
            <Square className="h-3.5 w-3.5" /> Force stop
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            disabled={!isRunning}
            onSelect={() => run("reboot")}
          >
            <RotateCw className="h-3.5 w-3.5" /> Reboot
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10"
            onSelect={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
