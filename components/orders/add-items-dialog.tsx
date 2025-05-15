import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { OrderType as Order, InventoryItem, OrderItem } from "@/types";
import { useFirebase } from "@/components/firebase-provider";
import { collection, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import { reduceInventoryStock } from "@/lib/inventory-utils";
import { CATEGORIES_WITHOUT_STOCK } from "@/lib/constants";

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
        // Ensure 'quantity' from Firestore is treated as stock number
        if (typeof itemData.stock === 'number') { // Prefer 'stock' field from Firestore if it exists and is number
          currentStock = itemData.stock;
        } else if (typeof itemData.quantity === 'number') { // Fallback to 'quantity' from Firestore
          currentStock = itemData.quantity;
        } else if (typeof itemData.quantity === 'string') { // Handle string quantity if necessary
          const parsedStock = parseInt(itemData.quantity, 10);
          currentStock = !isNaN(parsedStock) ? parsedStock : 0;
        }
        return {
          uid: itemDoc.id,
          name: itemData.name || 'Unnamed Item',
          category: selectedCategory,
          price: Number(itemData.price || 0),
          quantity: currentStock, // This is InventoryItem.quantity (actual stock)
          unit: itemData.unit || '',
          description: itemData.description || '',
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

    // Find the selected inventory item details
    const inventoryItemDetails = items.find(i => i.uid === selectedItem);
    if (!inventoryItemDetails) {
      toast.error("Selected item not found in inventory.");
      return;
    }

    // Stock Pre-Check for stock-controlled items
    const requiresStockCheck = inventoryItemDetails.category && !CATEGORIES_WITHOUT_STOCK.includes(inventoryItemDetails.category);
    if (requiresStockCheck) {
      const currentItemStock = inventoryItemDetails.quantity !== undefined ? inventoryItemDetails.quantity : 0; // Use .quantity for InventoryItem's stock
      if (currentItemStock < quantity) {
        toast.error(`Quantidade (${quantity}) excede o estoque disponível (${currentItemStock}) para ${inventoryItemDetails.name}.`);
        return;
      }
    }

    try {
      // 1. Get current items from the order prop, ensuring it's an array
      let currentItems: OrderItem[];
      if (Array.isArray(order.items)) {
        currentItems = order.items;
      } else if (typeof order.items === 'object' && order.items !== null) {
        currentItems = Object.values(order.items);
      } else {
        currentItems = [];
      }

      // 2. Prepare the new item details (pero aún no lo creamos como OrderItem completo)
      let updatedItems: OrderItem[];
      const existingItemIndex = currentItems.findIndex(item => item.itemId === inventoryItemDetails.uid);

      if (existingItemIndex !== -1) {
        updatedItems = currentItems.map((item, index) => {
          if (index === existingItemIndex) {
            return {
              ...item,
              quantity: item.quantity + quantity,
            };
          }
          return item;
        });
        toast.info(`Cantidad de "${inventoryItemDetails.name}" actualizada en la orden.`);
      } else {
        const newOrderItemToAdd: OrderItem = {
          id: uuidv4(),
          itemId: inventoryItemDetails.uid,
          name: inventoryItemDetails.name,
          category: inventoryItemDetails.category || '',
          price: inventoryItemDetails.price || 0,
          quantity: quantity,
          stock: inventoryItemDetails.quantity !== undefined ? inventoryItemDetails.quantity : 0, // Populate OrderItem.stock with current inventory stock
          unit: inventoryItemDetails.unit || '',
          description: inventoryItemDetails.description || '',
          notes: '', // Added: default notes
          status: 'pending', // Added: default status
          isVegetarian: false,
          isVegan: false,
          isGlutenFree: false,
          isLactoseFree: false,
          customDietaryRestrictions: []
        };
        updatedItems = [...currentItems, newOrderItemToAdd];
        toast.success(`"${inventoryItemDetails.name}" x${quantity} añadido a la orden.`);
      }

      // 3. Calculate new subtotal and total based on updatedItems
      let newSubtotal = 0;
      updatedItems.forEach((it: OrderItem) => {
        newSubtotal += (it.price || 0) * (it.quantity || 0);
      });

      const newTotal = newSubtotal;

      if (!db || !order.id) {
        toast.error("Error adding item: Order ID not found.");
        return;
      }
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        items: updatedItems,
        subtotal: newSubtotal,
        total: newTotal,
        updatedAt: new Date()
      });

      // --- Stock Deduction Logic ---
      if (requiresStockCheck) {
        console.log(`Deducting stock in AddItemsDialog for: ${inventoryItemDetails.name}, Qty: ${quantity}`);
        const stockDeductionResult = await reduceInventoryStock({
          db,
          item: {
            id: inventoryItemDetails.uid, // ID of the item in the 'inventory' collection
            category: inventoryItemDetails.category,
            name: inventoryItemDetails.name, // For context
            price: inventoryItemDetails.price || 0, // Ensure price is a number
            unit: inventoryItemDetails.unit || 'un', 
            quantity: 0, // Dummy, not used by reduceInventoryStock for deduction path
          },
          quantityToReduce: quantity, // This is the quantity *being added* in this operation
        });

        if (stockDeductionResult.success) {
          console.log(
            `Stock for item "${inventoryItemDetails.name}" (ID: ${inventoryItemDetails.uid}) successfully reduced by ${quantity} via AddItemsDialog. New stock: ${stockDeductionResult.newStock}`
          );
        } else {
          console.error(
            `Failed to reduce stock for item "${inventoryItemDetails.name}" (ID: ${inventoryItemDetails.uid}) via AddItemsDialog. Error: ${stockDeductionResult.error}`
          );
          toast.error(
            `Falha ao deduzir estoque para ${inventoryItemDetails.name} ao adicionar: ${stockDeductionResult.error}`
          );
        }
      }
      // --- End Stock Deduction Logic ---

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