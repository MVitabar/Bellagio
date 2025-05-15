// components/orders/order-details-dialog.tsx
import React, { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { OrderType as Order, OrderDetailsDialogProps, OrderItem, OrderItemStatus } from '@/types'
import { useRouter } from 'next/navigation'
import { splitOrderItemsByCategory, canViewBothSections, canViewOnlyFood, canViewOnlyDrinks, getOrderStatusFromItems, calculateOrderStatusFromItems } from '@/lib/orderFilters';
import { useAuth } from '@/components/auth-provider';
import { doc, updateDoc, onSnapshot, deleteField } from 'firebase/firestore';
import { useFirebase } from '@/components/firebase-provider';
import { toast } from 'sonner';

export function OrderDetailsDialog({ 
  order, 
  open, 
  onOpenChange 
}: OrderDetailsDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { db } = useFirebase();

  // Estado local para la orden en vivo
  const [liveOrder, setLiveOrder] = useState(order);

  useEffect(() => {
    setLiveOrder(order);
  }, [order]);

  // Suscripción en tiempo real al documento de la orden
  useEffect(() => {
    if (!db || !order.id || !open) return;

    const orderRef = doc(db, 'orders', order.id);
    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        setLiveOrder({ ...order, ...docSnap.data() });
      }
    });

    return () => unsubscribe();
  }, [db, order.id, open]);

  // Helpers para el status de ítem
  function getNextStatus(current: OrderItemStatus = 'pending'): OrderItemStatus {
    if (current === 'pending') return 'preparing';
    if (current === 'preparing') return 'ready';
    if (current === 'ready') return 'delivered';
    return 'delivered';
  }

  function getStatusButtonLabel(current: OrderItemStatus = 'pending') {
    if (current === 'pending') return "Marcar como Em Preparo";
    if (current === 'preparing') return "Marcar como Pronto";
    if (current === 'ready') return "Marcar como Entregue";
    return "Entregue";
  }

  function getAvailableStatusActions(current: OrderItemStatus = 'pending') {
    const actions = [];
    if (current !== 'finished') {
      actions.push({ status: 'finished', label: "Marcar como Finalizado" });
    }
    return actions;
  }

  // Nueva función para traducir restricciones dietéticas directamente
  function translateDietaryRestrictionPt(restrictionKey: string): string {
    switch (restrictionKey) {
      case 'vegetarian': return 'Vegetariano';
      case 'vegan': return 'Vegano';
      case 'gluten_free': return 'Sem Glúten';
      case 'lactose_free': return 'Sem Lactose';
      case 'nut_free': return 'Sem Nozes';
      case 'halal': return 'Halal';
      case 'kosher': return 'Kosher';
      case 'other': return 'Outro'; // Simplificado, "especificar" usualmente es parte del input
      default: return restrictionKey; // Fallback
    }
  }

  const handleUpdateItemStatus = async (item: OrderItem, newStatus: OrderItemStatus) => {
    const itemsArray: OrderItem[] = liveOrder.items || [];

    const updatedItems = itemsArray.map(i =>
      i.id === item.id ? { ...i, status: newStatus } : i
    );

    let newOrderStatus = getOrderStatusFromItems(updatedItems);

    if (!liveOrder.id) {
      toast.error("Não é possível atualizar: ID do pedido ausente");
      return;
    }
    if (!db) {
      toast.error("Database not found");
      return;
    }
    const orderRef = doc(db, "orders", liveOrder.id);

    try {
      await updateDoc(orderRef, { items: deleteField() });
      await updateDoc(orderRef, { items: updatedItems, status: newOrderStatus });
    } catch (error) {
      toast.error("Erro ao atualizar no Firestore");
    }
  };

  // Robustly get itemsArray, converting from map if necessary
  let itemsArray: OrderItem[] = [];
  const currentItems = liveOrder?.items;
  if (Array.isArray(currentItems)) {
    itemsArray = currentItems;
  } else if (currentItems && typeof currentItems === 'object') {
    itemsArray = Object.keys(currentItems)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map(key => (currentItems as any)[key] as OrderItem);
  } // Else, itemsArray remains [] if currentItems is null/undefined

  const { comidas, bebidas } = splitOrderItemsByCategory(itemsArray);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" aria-describedby="order-details-description">
        <DialogHeader>
          <DialogTitle>{"Detalhes do Pedido"}</DialogTitle>
          <DialogDescription id="order-details-description">
            {"Visualize os detalhes do pedido abaixo."}
          </DialogDescription>
        </DialogHeader>

        {!['chef', 'barman'].includes(user?.role ?? '') && (
          <div className="flex gap-2 mb-4">
            {/* <Button onClick={handleGlobalStatusUpdate}>
              {"Alterar Status Global"}
            </Button> */}
            {/* <Button onClick={handleDeleteOrder} variant="destructive">
              {"Excluir Pedido"}
            </Button> */}
          </div>
        )}
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-sm font-medium">{"Número da Mesa"}:</span>
            <span className="col-span-3">{liveOrder.tableNumber || "Não disponível"}</span>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-sm font-medium">{"Status"}:</span>
            <span className="col-span-3">{liveOrder.status}</span>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-sm font-medium">{"Total"}:</span>
            <span className="col-span-3">
              {new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
              }).format(liveOrder.total)}
            </span>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-sm font-medium">{"Itens"}:</span>
            <div className="col-span-3">
              {(canViewBothSections(user?.role) || canViewOnlyFood(user?.role)) && (
                <>
                  <h4 className="font-semibold mb-1">{"Comidas"}</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    {comidas.map((item) => (
                      <span key={item.id} className="text-sm bg-muted rounded-md px-2 py-1">
                        {item.name} x{item.quantity}
                        {item.customDietaryRestrictions && item.customDietaryRestrictions.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.customDietaryRestrictions.map(restriction => 
                              translateDietaryRestrictionPt(restriction)
                            ).join(', ')})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {(canViewBothSections(user?.role) || canViewOnlyDrinks(user?.role)) && (
                <>
                  <h4 className="font-semibold mb-1 mt-2">{"Bebidas"}</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    {bebidas.map((item) => (
                      <span key={item.id} className="text-sm bg-muted rounded-md px-2 py-1">
                        {item.name} x{item.quantity}
                        {item.customDietaryRestrictions && item.customDietaryRestrictions.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.customDietaryRestrictions.map(restriction => 
                              translateDietaryRestrictionPt(restriction)
                            ).join(', ')})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {"Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}