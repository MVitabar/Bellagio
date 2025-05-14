import { Order, OrderItem } from '@/types/index';
import { UserRole } from '@/types';
import { OrderItemStatus, OrderStatus } from '@/types/index';

// --- START NEW HELPER FUNCTIONS ---
// Define which category IDs are considered 'Food'
const FOOD_CATEGORIES = [
  'acompanhamentos',
  'almoco',
  'jantar'
];

const isFoodCategory = (categoryId?: string): boolean => {
  if (!categoryId) return false;
  const lowerCategoryId = categoryId.toLowerCase();
  return FOOD_CATEGORIES.includes(lowerCategoryId);
};

// Define which category IDs are considered 'Drinks'
const DRINK_CATEGORIES = [
  'cervejas',
  'drinks',
  'refrigerantes',
  'vinhos'
];

const isDrinkCategory = (categoryId?: string): boolean => {
  if (!categoryId) return false;
  const lowerCategoryId = categoryId.toLowerCase();
  return DRINK_CATEGORIES.includes(lowerCategoryId);
};

// Mapeo de categorías del inventario a categorías de orden
const INVENTORY_TO_ORDER_CATEGORY: Record<string, string> = {
  'cervejas': 'cervejas',
  'drinks': 'drinks',
  'refrigerantes': 'refrigerantes',
  'vinhos': 'vinhos',
  'acompanhamentos': 'acompanhamentos',
  'almoco': 'almoco',
  'jantar': 'jantar'
};

// Función para normalizar la categoría de un item
export const normalizeItemCategory = (item: OrderItem): OrderItem => {
  if (!item.category) {
    // Si no tiene categoría, intentar inferirla del nombre
    const lowerName = item.name.toLowerCase();
    
    if (lowerName.includes('cerveja')) {
      return { ...item, category: 'cervejas' };
    }
    if (lowerName.includes('coca') || lowerName.includes('suco')) {
      return { ...item, category: 'refrigerantes' };
    }
    if (lowerName.includes('vinho')) {
      return { ...item, category: 'vinhos' };
    }
    // Por defecto, asumimos que es comida
    return { ...item, category: 'almoco' };
  }
  
  const lowerCategory = item.category.toLowerCase();
  
  // Si la categoría ya está en el mapeo, usarla
  if (INVENTORY_TO_ORDER_CATEGORY[lowerCategory]) {
    return { ...item, category: INVENTORY_TO_ORDER_CATEGORY[lowerCategory] };
  }
  
  // Si tiene una categoría no válida, intentamos mapearla
  if (lowerCategory.includes('drink') || lowerCategory.includes('bebida')) {
    return { ...item, category: 'drinks' };
  }
  
  // Por defecto, asumimos que es comida
  return { ...item, category: 'almoco' };
};

export function splitOrderItemsByCategory(items: OrderItem[] | undefined | null) {
  if (!Array.isArray(items)) {
    return { comidas: [], bebidas: [] };
  }
  
  // Normalizar todos los items primero
  const normalizedItems = items.map(normalizeItemCategory);
  
  // Separar en comidas y bebidas
  const comidas = normalizedItems.filter(item => {
    const isFood = isFoodCategory(item.category);
    return isFood;
  });
  
  const bebidas = normalizedItems.filter(item => {
    const isDrink = isDrinkCategory(item.category);
    return isDrink;
  });
  
  // Log del resultado final
  return { comidas, bebidas };
}

// Filtra órdenes según el rol del usuario
type FilterOrdersByRoleArgs = {
  orders: Order[];
  role: UserRole;
};

export function filterOrdersByRole({ orders, role }: FilterOrdersByRoleArgs): Order[] {
  if (role === 'chef' || role === 'barman') {
    // Solo órdenes pendientes para chef y barman (no ready, no finished, no delivered)
    return orders.filter(order => order.status === 'Pendente');
  }
  // Otros roles ven todas las órdenes
  return orders;
}

// Helper para saber si el rol puede ver ambas secciones
export function canViewBothSections(role?: UserRole): boolean {
  if (role === undefined) return false;
  return (
    role === 'owner' ||
    role === 'manager' ||
    role === 'admin' ||
    role === 'waiter'
  );
}

// Helper para saber si el rol solo ve comidas
export function canViewOnlyFood(role?: UserRole): boolean {
  if (role === undefined) return false;
  return role === 'chef';
}

// Helper para saber si el rol solo ve bebidas
export function canViewOnlyDrinks(role?: UserRole): boolean {
  if (role === undefined) return false;
  return role === 'barman';
}

// --- Nuevo helper: actualizar status global de la orden según status de ítems ---
/**
 * Calcula el status global de la orden según el status de todos los ítems.
 * - Si al menos uno está 'preparing', la orden queda 'Pendente'.
 * - Si al menos uno está 'pending', la orden queda 'Pendente'.
 * - Nota: Esta función se enfoca en los estados transicionales basados en ítems.
 *   Estados como 'Fechado', 'Pago', 'Cancelado' se manejan externamente.
 */
export function getOrderStatusFromItems(items: OrderItem[]): OrderStatus {
  if (!items || items.length === 0) {
    return 'Pendente'; // Estado por defecto para orden vacía o sin items
  }

  const todosEntregues = items.every(item => item.status === 'delivered');
  if (todosEntregues) {
    return 'Entregue';
  }

  const todosProntosOuEntregues = items.every(item => item.status === 'ready' || item.status === 'delivered');
  if (todosProntosOuEntregues) {
    return 'Pronto para servir';
  }

  // Si hay algún item 'pending' o 'preparing', la orden general está 'Pendente'.
  // No se diferencia entre 'Em preparo' y 'Pendente' a nivel de orden general aquí,
  // ya que 'Pronto para servir' cubre cuando todo está al menos 'ready'.
  // Cualquier cosa antes de eso es efectivamente 'Pendente' desde la perspectiva del cliente/camarero.
  if (items.some(item => item.status === 'pending' || item.status === 'preparing')) {
    return 'Pendente';
  }
  
  // Fallback si los estados de los items son inesperados, aunque la lógica anterior debería cubrir todos los casos.
  // Podríamos también devolver el estado de orden más "temprano" si hay una mezcla no cubierta.
  // Por ahora, si no es Servido, ni Pronto para Servir, y no hay nada Pendente/Preparando explícitamente,
  // lo más seguro es marcarlo como Pendente.
  // Esto podría pasar si todos los items están 'finished' pero no 'delivered' o 'ready' (un caso que OrderItemStatus permite).
  // Si 'finished' a nivel de item implica que está listo para la agregación de la orden, entonces 'Pronto para servir' sería correcto.
  // Asumamos que 'finished' es un estado final de item que no necesariamente significa 'listo para servir' sin una transición explícita a 'ready'.
  if (items.every(item => item.status === 'finished')) {
    // Si todos los items individuales están 'finished', ¿qué estado de orden corresponde?
    // Podría ser 'Pronto para servir' o incluso 'Servido' dependiendo de tu flujo.
    // Por ahora, si todos están 'finished', es razonable pensar que están listos.
    return 'Pronto para servir'; 
  }

  return 'Pendente'; // Fallback general
}

// Calcula el status global de la orden basado en los ítems
// ESTA FUNCIÓN SE PUEDE CONSIDERAR OBSOLETA O PARA REFACTORIZAR
// SI LA LÓGICA DE getOrderStatusFromItems ES SUFICIENTE.
export function calculateOrderStatusFromItems(items: OrderItem[], currentStatus: OrderStatus): OrderStatus {
  if (items.length === 0) return currentStatus;

  // La nueva función getOrderStatusFromItems es más completa.
  // Podríamos llamarla aquí o replicar su lógica adaptada.
  const derivedStatus = getOrderStatusFromItems(items);
  
  // Se podría añadir lógica aquí para no revertir un estado de orden si ya está más avanzado.
  // Por ejemplo, si currentStatus es 'Pago', no debería cambiar a 'Pendente' solo por los items.
  // Sin embargo, los estados finales como Pago, Fechado, Cancelado se manejan explícitamente en otro lugar.
  // Esta función debería enfocarse en los estados transicionales: Pendente, Pronto para Servir, Servido.
  if (currentStatus === 'Pago' || currentStatus === 'Cancelado') {
    return currentStatus; // No cambiar estados finales basados en items.
  }

  return derivedStatus;
}