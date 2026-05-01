"use client"

import { useState } from "react"
import { MoreHorizontal, Edit, Trash, EyeOff, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ServiceDialog, Service } from "./service-dialog"
import { toggleServiceActive, deleteService } from "@/app/admin/services/actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function ServiceActions({ service }: { service: Service }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const router = useRouter()

  async function onToggleActive() {
    try {
      await toggleServiceActive(service.id, !service.active)
      toast.success(service.active ? "Service deactivated" : "Service activated")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to update service")
    }
  }

  async function onDelete() {
    if (!confirm("Are you sure you want to delete this service? This action cannot be undone.")) return
    
    try {
      await deleteService(service.id)
      toast.success("Service deleted")
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete service")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="ghost" className="h-8 w-8 p-0 text-white/50 hover:text-white">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        } />
        <DropdownMenuContent align="end" className="bg-[#1c1c1c] border-white/10 text-white">
          <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:bg-white/10 cursor-pointer" onClick={onToggleActive}>
            {service.active ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" /> Deactivate
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" /> Activate
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-danger hover:bg-danger/10 hover:text-danger cursor-pointer" onClick={onDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ServiceDialog service={service} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
    </>
  )
}
