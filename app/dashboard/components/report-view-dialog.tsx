import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ReportViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  data: Record<string, any>; // Using Record<string, any> for flexibility
  description?: string;
}

export function ReportViewDialog({ 
  open, 
  onOpenChange, 
  title, 
  data, 
  description 
}: ReportViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[150px_1fr] items-center gap-4">
              <span className="text-sm font-medium capitalize text-muted-foreground">
                {key.replace(/([A-Z])/g, ' $1').trim()}: {/* Prettify key */}
              </span>
              <span className="text-sm">
                {typeof value === 'number' ? value.toFixed(2) : String(value)}
              </span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
