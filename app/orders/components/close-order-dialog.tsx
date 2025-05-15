import { useState } from "react"
import { doc, updateDoc } from "firebase/firestore"
import { useFirebase } from "@/components/firebase-provider"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Order } from "@/types/order"

interface CloseOrderDialogProps {
  order: Order
  open: boolean
  onClose: () => void
  onOrderClosed: () => void
}

const PAYMENT_METHODS = [
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito' },
  { value: 'Cartão de Débito', label: 'Cartão de Débito' },
  { value: 'PIX', label: 'PIX' },
  { value: 'Outro', label: 'Outro' }
] as const

export function CloseOrderDialog({
  order,
  open,
  onClose,
  onOrderClosed
}: CloseOrderDialogProps) {
  const { db } = useFirebase()
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCloseOrder = async () => {
    if (!paymentMethod) {
      toast.error("Selecione um método de pagamento")
      return
    }

    if (!db) {
      toast.error("Erro de conexão com o banco de dados")
      return
    }

    if (!order?.id) {
      toast.error("ID do pedido inválido")
      return
    }

    setIsSubmitting(true)
    try {
      const orderRef = doc(db, 'orders', order.id)
      await updateDoc(orderRef, {
        status: 'Pago' as const,
        paymentMethod,
        updatedAt: new Date()
      })

      toast.success("Pedido fechado com sucesso")
      onOrderClosed()
      onClose()
    } catch (error) {
      console.error("Error closing order:", error)
      toast.error("Erro ao fechar o pedido")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset payment method when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPaymentMethod("")
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar Pedido</DialogTitle>
          <DialogDescription>
            Selecione o método de pagamento para fechar o pedido #{order.orderNumber || order.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Método de Pagamento</label>
            <Select
              value={paymentMethod}
              onValueChange={setPaymentMethod}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um método" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Total a pagar</p>
            <p className="text-2xl font-bold">
              R$ {order.total.toFixed(2)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCloseOrder} 
            disabled={isSubmitting || !paymentMethod}
          >
            {isSubmitting ? "Fechando..." : "Fechar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
