// lib/inventory-utils.ts
import { 
  doc, 
  updateDoc, 
  getDoc, 
  Firestore,
} from 'firebase/firestore';

// Tipos para manejar el inventario
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  unit: string;
}

interface InventoryUpdateParams {
  db: Firestore;
  item: InventoryItem;
  quantityToReduce: number;
}

interface InventoryCheckResult {
  success: boolean;
  newStock?: number;
  error?: string;
}

interface InventoryAvailabilityResult {
  isAvailable: boolean;
  unavailableItems: InventoryItem[];
}

export async function reduceInventoryStock({
  db, 
  item, 
  quantityToReduce
}: InventoryUpdateParams): Promise<InventoryCheckResult> {
  try {
    // Referencia al documento del item en inventario
    const itemRef = doc(
      db, 
      'inventory', 
      item.category, 
      'items', 
      item.id
    );

    // Obtener el documento actual
    const itemDoc = await getDoc(itemRef);
    
    if (!itemDoc.exists()) {
      throw new Error(`Item ${item.id} not found in inventory`);
    }

    const currentStock = itemDoc.data().quantity || 0;

    // Validar stock suficiente
    if (currentStock < quantityToReduce) {
      throw new Error(`Insufficient stock for item ${item.id}. Current: ${currentStock}, Requested: ${quantityToReduce}`);
    }

    // Actualizar stock
    await updateDoc(itemRef, {
      quantity: currentStock - quantityToReduce
    });

    return {
      success: true,
      newStock: currentStock - quantityToReduce
    };

  } catch (error) {
    console.error('Error updating inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkInventoryAvailability(
  db: Firestore, 
  items: Array<InventoryItem>
): Promise<InventoryAvailabilityResult> {
  const unavailableItems: Array<InventoryItem> = [];

  for (const item of items) {
    const itemRef = doc(
      db, 
      'inventory', 
      item.category, 
      'items', 
      item.id
    );

    const itemDoc = await getDoc(itemRef);
    
    if (!itemDoc.exists()) {
      unavailableItems.push(item);
      continue;
    }

    const currentStock = itemDoc.data().quantity || 0;
    
    if (currentStock < item.quantity) {
      unavailableItems.push(item);
    }
  }

  return {
    isAvailable: unavailableItems.length === 0,
    unavailableItems
  };
}