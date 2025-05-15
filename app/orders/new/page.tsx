"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"
import { useFirebase } from "@/components/firebase-provider"
import { useAuth } from "@/components/auth-provider"
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash, ArrowLeft } from "lucide-react"
import { OrderForm } from "@/components/orders/order-form"
import { useNotifications } from "@/hooks/useNotifications"
import { toast } from "sonner"
import { Order, OrderItem } from "@/types/order"
import { reduceInventoryStock } from "@/lib/inventory-utils";
import { CATEGORIES_WITHOUT_STOCK } from "@/lib/constants";

export default function NewOrderPage() {
  const { t } = useI18n()
  const { db } = useFirebase()
  const { user } = useAuth()
  const router = useRouter()
  const { sendNotification } = useNotifications()

  // Utility function to remove undefined values from an object
  const removeUndefinedValues = (obj: Record<string, any>): Record<string, any> => {
    // Si es null o undefined, retornar como está
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Si es un array, procesarlo como array
    if (Array.isArray(obj)) {
      return obj.map(item => {
        if (typeof item === 'object' && item !== null) {
          return removeUndefinedValues(item);
        }
        return item;
      });
    }

    // Detectar si el objeto parece ser un array (tiene keys numéricas consecutivas)
    const keys = Object.keys(obj);
    const isArrayLike = keys.length > 0 && 
      keys.every((key, index) => !isNaN(Number(key)) && Number(key) === index);

    // Si parece un array y la propiedad es 'items', convertirlo
    if (isArrayLike) {
      return Object.values(obj).map(item => {
        if (typeof item === 'object' && item !== null) {
          return removeUndefinedValues(item);
        }
        return item;
      });
    }

    // Procesar como objeto normal
    const cleanedObj: Record<string, any> = {};
    
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        if (Array.isArray(obj[key])) {
          cleanedObj[key] = obj[key].map((item: any) => {
            if (typeof item === 'object' && item !== null) {
              return removeUndefinedValues(item);
            }
            return item;
          });
        }
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
          const cleanedNestedObj = removeUndefinedValues(obj[key]);
          if (Object.keys(cleanedNestedObj).length > 0) {
            cleanedObj[key] = cleanedNestedObj;
          }
        } else {
          cleanedObj[key] = obj[key];
        }
      }
    });
    
    return cleanedObj;
  };

  const handleCreateOrder = async (order: Order) => {
    if (!db || !user) {
      toast.error("Database or user not found")
      return
    }

    // The 'items' array from the order object, to be used for stock deduction
    // Ensure we are using the array of OrderItem objects
    const orderItemsForStockDeduction: OrderItem[] = Array.isArray(order.items)
      ? order.items
      : order.items
        ? Object.values(order.items)
        : [];

    try {
      const ordersRef = collection(db, 'orders')
      
      // Remove undefined values from the order
      const cleanedOrder = removeUndefinedValues(order);

      // Asegurarse de que items sea siempre un array for saving to Firestore
      const itemsToSaveInOrder = Array.isArray(cleanedOrder.items) 
        ? cleanedOrder.items 
        : cleanedOrder.items 
          ? Object.values(cleanedOrder.items) 
          : [];

      const newOrderRef = await addDoc(ordersRef, {
        ...cleanedOrder,
        items: itemsToSaveInOrder, // Sobreescribir items con el array procesado para guardar
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: cleanedOrder.status || 'Pendente' // Default status if not provided
      })

      // IMPORTANTE: Guarda el id generado por Firestore en el documento
      await updateDoc(newOrderRef, { id: newOrderRef.id });
      toast.success("Pedido criado com sucesso! ID: " + newOrderRef.id); // Confirmation

      // --- Stock Deduction Logic --- 
      for (const item of orderItemsForStockDeduction) {
        if (item.category && !CATEGORIES_WITHOUT_STOCK.includes(item.category)) {
          if (!item.itemId) {
            console.warn(`Order item "${item.name}" is missing itemId. Skipping stock deduction.`);
            continue;
          }
          console.log(`Deducting stock for item: ${item.name}, Category: ${item.category}, ItemID: ${item.itemId}, Quantity: ${item.quantity}`);
          const stockDeductionResult = await reduceInventoryStock({
            db,
            item: {
              id: item.itemId, // This is the ID of the item in the 'inventory' collection
              category: item.category,
              name: item.name, // For context, not used in path by reduceInventoryStock
              // The other fields of InventoryItem (price, unit, quantity) are not strictly needed here by reduceInventoryStock
              // but reduceInventoryStock expects an InventoryItem-like structure for its 'item' param.
              // We provide the essential 'id' and 'category' for path construction.
              // Dummy values for other InventoryItem fields if strict typing enforced by a deeper utility.
              price: item.price, 
              unit: item.unit || 'un', 
              quantity: 0, // This quantity is not used for deduction logic itself by reduceInventoryStock, quantityToReduce is separate
            },
            quantityToReduce: item.quantity,
          });

          if (stockDeductionResult.success) {
            console.log(
              `Stock for item "${item.name}" (ID: ${item.itemId}) successfully reduced by ${item.quantity}. New stock: ${stockDeductionResult.newStock}`
            );
          } else {
            console.error(
              `Failed to reduce stock for item "${item.name}" (ID: ${item.itemId}). Error: ${stockDeductionResult.error}`
            );
            toast.error(
              `Falha ao deduzir estoque para ${item.name}: ${stockDeductionResult.error}`
            );
            // Consider how to handle this critical error - order is placed, stock not deducted.
            // For now, we log and notify the user.
          }
        }
      }
      // --- End Stock Deduction Logic ---

      // Notificación push con OneSignal
      await sendNotification({
        title: "Nuevo Pedido",
        message: `Mesa ${order.tableNumber} - Total: $${order.total}`,
        url: `/orders/${newOrderRef.id}`
      })

      // Optional: Navigate back to orders page or show order details
      router.push('/orders')
    } catch (error) {
      console.error("Error creating order:", error)
      toast.error("Erro ao criar pedido")
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">{t("newOrderPage.title")}</h1>
      </div>

      {user ? (
        <OrderForm 
          user={user}
          onOrderCreated={handleCreateOrder}
        />
      ) : (
        <p>Usuário não autenticado</p>
      )}
    </div>
  )
}
