import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Order, InventoryItem, OrderItem } from "@/types";
import { useFirebase } from "@/components/firebase-provider";
import { collection, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

// Ajuste: Definición local de Category (solo id, opcional name)
type Category = {
  id: string;
  name?: string;
};

interface AddItemsDialogProps {
  order: Order;
  open: boolean;
  onClose: () => void;
  onItemsAdded?: () => void;
}

export function AddItemsDialog({ order, open, onClose, onItemsAdded }: AddItemsDialogProps) {
  const { db } = useFirebase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  // Cargar categorías
  useEffect(() => {
    if (!db || !open) return;
    const fetchCategories = async () => {
      const inventoryRef = collection(db, 'inventory');
      const snap = await getDocs(inventoryRef);
      setCategories(snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id })));
    };
    fetchCategories();
  }, [db, open]);

  // Cargar items de la categoría seleccionada
  useEffect(() => {
    if (!db || !selectedCategory) return;
    const fetchItems = async () => {
      const itemsRef = collection(db, 'inventory', selectedCategory, 'items');
      const snap = await getDocs(itemsRef);
      setItems(snap.docs.map(itemDoc => {
        const itemData = itemDoc.data();
        let currentStock = 0;
        if (typeof itemData.quantity === 'number') {
          currentStock = itemData.quantity;
        } else if (typeof itemData.quantity === 'string') {
          const parsedStock = parseInt(itemData.quantity, 10);
          currentStock = !isNaN(parsedStock) ? parsedStock : 0;
        }
        return {
          uid: itemDoc.id,
          name: itemData.name || 'Unnamed Item',
          category: selectedCategory,
          price: Number(itemData.price || 0),
          quantity: currentStock, // MODIFICADO: Usar 'quantity' para el stock, según InventoryItem
          unit: itemData.unit || '',
          description: itemData.description || '',
          // Otros campos de InventoryItem si son necesarios
        } as InventoryItem;
      }));
    };
    fetchItems();
  }, [db, selectedCategory]);

  const handleAddItem = async () => {
    if (!selectedItem || quantity < 1) return;
    if (!order.id) {
      toast.error("No order ID found.");
      return;
    }
    try {
      // 1. Get current items from the order prop, ensuring it's an array
      let currentItems: OrderItem[];
      if (Array.isArray(order.items)) {
        currentItems = order.items;
      } else if (typeof order.items === 'object' && order.items !== null) {
        // If it's an object (like from old Firebase data), convert its values to an array
        // This assumes the object's values are the OrderItems
        currentItems = Object.values(order.items);
      } else {
        // Default to an empty array if items is undefined, null, or not an array/object
        currentItems = [];
      }

      // 2. Prepare the new item details (pero aún no lo creamos como OrderItem completo)
      const inventoryItemDetails = items.find(i => i.uid === selectedItem); // Este es el InventoryItem
      if (!inventoryItemDetails) {
        toast.error("Selected item not found in inventory.");
        return;
      }

      let updatedItems: OrderItem[];
      const existingItemIndex = currentItems.findIndex(item => item.itemId === inventoryItemDetails.uid);

      if (existingItemIndex !== -1) {
        // Item ya existe, actualizar cantidad
        updatedItems = currentItems.map((item, index) => {
          if (index === existingItemIndex) {
            return {
              ...item,
              quantity: item.quantity + quantity, // Sumar la nueva cantidad a la existente
            };
          }
          return item;
        });
        toast.info(`Cantidad de "${inventoryItemDetails.name}" actualizada en la orden.`);
      } else {
        // Item no existe, añadirlo como nuevo
        const newOrderItemToAdd: OrderItem = {
          id: uuidv4(), // ID único para esta instancia de OrderItem
          itemId: inventoryItemDetails.uid, // ID del producto en el inventario
          name: inventoryItemDetails.name,
          category: inventoryItemDetails.category || '',
          price: inventoryItemDetails.price || 0,
          quantity: quantity, // Cantidad inicial seleccionada
          stock: inventoryItemDetails.quantity !== undefined ? inventoryItemDetails.quantity : null, // Stock del inventario
          unit: inventoryItemDetails.unit || '',
          // Asegúrate de que todos los campos requeridos por OrderItem estén aquí
          status: 'pending', // O el estado por defecto que uses
          notes: '', // etc.
          description: inventoryItemDetails.description || '',
        };
        updatedItems = [...currentItems, newOrderItemToAdd];
        toast.success(`"${inventoryItemDetails.name}" x${quantity} añadido a la orden.`);
      }

      // 3. Calculate new subtotal and total based on updatedItems
      let newSubtotal = 0;
      updatedItems.forEach((it: OrderItem) => { // Explicitly type 'it' as OrderItem
        newSubtotal += (it.price || 0) * (it.quantity || 0);
      });

      const newTotal = newSubtotal; // Assuming no tax/discount for now

      // DEBUG: Log values before Firestore update
      // console.log("[AddItemsDialog DEBUG] Order ID:", order.id);
      // console.log("[AddItemsDialog DEBUG] Items for calculation (updatedItems):", JSON.parse(JSON.stringify(updatedItems))); // Deep copy for clean log
      // console.log("[AddItemsDialog DEBUG] Calculated newSubtotal:", newSubtotal);
      // console.log("[AddItemsDialog DEBUG] Calculated newTotal:", newTotal);

      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        items: updatedItems, // Use the fully updated list of items
        subtotal: newSubtotal,
        total: newTotal,
        // Potentially update other fields like tax, discount if they exist and are calculated
        updatedAt: new Date() // Good practice to update timestamp
      });

      toast.success("Item added and order updated");
      if (onItemsAdded) onItemsAdded();
      onClose();
    } catch (error) {
      console.error("Error adding item to order:", error);
      toast.error("Error adding item: " + (error instanceof Error ? error.message : ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby="add-items-description">
        <DialogHeader>
          <DialogTitle>Add Items to Order</DialogTitle>
          <DialogDescription id="add-items-description">
            Select items and quantity to add to the order.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              {selectedCategory
                ? categories.find(c => c.id === selectedCategory)?.name || "Select Category"
                : "Select Category"}
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name || cat.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedItem} onValueChange={setSelectedItem} disabled={!selectedCategory}>
            <SelectTrigger>
              {selectedItem
                ? items.find(i => i.uid === selectedItem)?.name || "Select Product"
                : "Select Product"}
            </SelectTrigger>
            <SelectContent>
              {items.map(item => (
                <SelectItem key={item.uid} value={item.uid}>{item.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(Number(e.target.value))}
            placeholder="Quantity"
            disabled={!selectedItem}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAddItem} disabled={!selectedItem || quantity < 1}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}