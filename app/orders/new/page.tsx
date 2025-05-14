"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/i18n-provider"
import { useFirebase } from "@/components/firebase-provider"
import { useAuth } from "@/components/auth-provider"
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Minus, Plus, Trash, ArrowLeft } from "lucide-react"
import { InventoryItem, OrderItem } from "@/types"
import { OrderForm } from "@/components/orders/order-form"
import { Order } from "@/types"
import { useNotifications } from "@/hooks/useNotifications"
import { toast } from "sonner"

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

    try {
      const ordersRef = collection(db, 'orders')
      
      // Remove undefined values from the order
      const cleanedOrder = removeUndefinedValues(order);

      // Asegurarse de que items sea siempre un array
      const items = Array.isArray(cleanedOrder.items) 
        ? cleanedOrder.items 
        : cleanedOrder.items 
          ? Object.values(cleanedOrder.items) 
          : [];

      const newOrderRef = await addDoc(ordersRef, {
        ...cleanedOrder,
        items, // Sobreescribir items con el array
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: cleanedOrder.status || 'pending'
      })

      // IMPORTANTE: Guarda el id generado por Firestore en el documento
      await updateDoc(newOrderRef, { id: newOrderRef.id });

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
