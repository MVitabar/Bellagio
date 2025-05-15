"use client"

import { useState, useEffect, useCallback, ChangeEvent } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { 
  doc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  getDoc 
} from "firebase/firestore"
import { Loader2, Plus, Minus, Trash, QrCode } from "lucide-react"
import { toast } from "sonner"
import QRCode from 'qrcode.react'
import { 
  OrderItem, 
  MenuItem, 
  BaseOrderStatus, 
  OrderType as Order,
  User,
  RestaurantTable,
  PaymentInfo,
  PaymentMethod,
  TableItem
} from "@/types"
import { 
  checkInventoryAvailability, 
  reduceInventoryStock,
  InventoryItem 
} from '@/lib/inventory-utils'
import { useNotifications } from "@/hooks/useNotifications"
import { CATEGORIES_WITHOUT_STOCK } from "@/lib/constants";

// Helper function for dietary restrictions
const dietaryKeyToPortuguese = (key: string): string => {
  switch (key) {
    case "vegetarian":
      return "Vegetariano";
    case "vegan":
      return "Vegano";
    case "gluten-free":
      return "Sem Glúten";
    case "lactose-free":
      return "Sem Lactose";
    default:
      return key;
  }
};

export function OrderForm({ 
  initialTableNumber, 
  onOrderCreated,
  user: propUser,
  table,
  onCancel
}: { 
  initialTableNumber?: string, 
  onOrderCreated?: (order: Order) => void | Promise<any>,
  user?: User | null,
  table?: TableItem | RestaurantTable,
  onCancel?: () => void
}) {
  const { db } = useFirebase()
  const { user: contextUser } = useAuth()
  const user = propUser || contextUser
  const { sendNotification } = useNotifications();

  if (!user) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-destructive">
          Usuário não autorizado a criar pedidos.
        </p>
      </div>
    )
  }

  // Use table prop if available, otherwise use initialTableNumber
  const [tableNumber, setTableNumber] = useState(table?.name || initialTableNumber || '')

  const [loading, setLoading] = useState(true)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  // Use string for category ID, initialize empty or fetch first category later
  const [selectedCategory, setSelectedCategory] = useState<string>('') 
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [specialRequests, setSpecialRequests] = useState("")
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage")

  const [selectedTable, setSelectedTable] = useState<{
    uid: string
    mapId: string
    number: number
  } | null>(null)
  const [tables, setTables] = useState<{uid: string, mapId: string, number: number}[]>([])

  const [selectedItem, setSelectedItem] = useState<string>("")
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState("")
  const [itemDietaryRestrictions, setItemDietaryRestrictions] = useState<string[]>([])

  const [showQRCode, setShowQRCode] = useState(false)
  const [menuUrl, setMenuUrl] = useState("https://v0-restaurante-milenio-website.vercel.app/")

  const [orderType, setOrderType] = useState<'table' | 'counter' | 'takeaway'>('table')

  const filteredMenuItems = menuItems.filter(
    item => item.category === selectedCategory
  )

  const handleAddItem = () => {
    const menuItem = menuItems.find((item) => item.uid === selectedItem)
    if (!menuItem) {
      toast.error("Item não encontrado no cardápio.")
      return;
    }

    if (quantity < 1) {
      toast.error("A quantidade deve ser pelo menos 1.");
      return;
    }

    // Check stock ONLY if the category requires it
    const requiresStockCheck = menuItem.category && !CATEGORIES_WITHOUT_STOCK.includes(menuItem.category);

    if (requiresStockCheck) {
      // Solo verificar stock si la categoría lo requiere
      if (menuItem.stock === undefined || menuItem.stock === null) {
        toast.error("Estoque não disponível para este item.");
        return;
      }
      if (menuItem.stock < quantity) {
        toast.error(`Quantidade excede o estoque disponível. Disponível: ${menuItem.stock}, Solicitado: ${quantity}`);
        return;
      }
    }

    const newItem: OrderItem = {
      id: `temp-${Date.now()}`,
      itemId: menuItem.uid,
      name: menuItem.name,
      category: menuItem.category || 'uncategorized',
      price: menuItem.price,
      quantity,
      unit: menuItem.unit || 'unidad',
      stock: requiresStockCheck ? (menuItem.stock || 0) : 0,
      notes: notes || '',
      status: 'pending',
      isVegetarian: itemDietaryRestrictions.includes('vegetarian'),
      isVegan: itemDietaryRestrictions.includes('vegan'),
      isGlutenFree: itemDietaryRestrictions.includes('gluten-free'),
      isLactoseFree: itemDietaryRestrictions.includes('lactose-free'),
      customDietaryRestrictions: itemDietaryRestrictions
    };

    const existingItemIndex = orderItems.findIndex((item) => item.itemId === menuItem.uid)

    if (existingItemIndex >= 0) {
      const totalRequestedQuantity = orderItems[existingItemIndex].quantity + quantity;
      
      // Check stock ONLY if the category requires it
      if (requiresStockCheck) {
        if (typeof menuItem.stock === 'number' && totalRequestedQuantity > menuItem.stock) {
          toast.error(`Quantidade total (${totalRequestedQuantity}) excede o estoque disponível (${menuItem.stock}).`);
          return;
        }
      }
      
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += quantity;
      setOrderItems(updatedItems);
    } else {
      setOrderItems([...orderItems, newItem]);
    }

    setQuantity(1);
    setNotes("");
    setItemDietaryRestrictions([]);
  }

  // Memoize fetchMenuItems to prevent unnecessary re-renders
  const memoizedFetchMenuItems = useCallback(async () => {
    if (!db || !user) {
      setLoading(false)
      return;
    }

    try {
      setLoading(true)
      const menuItems: MenuItem[] = []

      // Fetch inventory reference using a single collection
      const inventoryRef = collection(db, 'inventory')

      // Fetch all category documents
      const categoriesSnapshot = await getDocs(inventoryRef)

      // Iterate through categories
      for (const categoryDoc of categoriesSnapshot.docs) {
        const category = categoryDoc.id

        // Reference to items subcollection for this category
        const itemsRef = collection(db, 'inventory', category, 'items')
        
        // Fetch items for this category
        const itemsSnapshot = await getDocs(itemsRef)

        // Process each item in the category
        const categoryItems = itemsSnapshot.docs.map(itemDoc => {
          const itemData = itemDoc.data()

          // Determine stock, with more flexible parsing
          let stock = 0
          if (typeof itemData.quantity === 'number') {
            stock = itemData.quantity
          } else if (typeof itemData.quantity === 'string') {
            const parsedStock = parseInt(itemData.quantity, 10)
            stock = !isNaN(parsedStock) ? parsedStock : 0
          }

          // Create menu item
          const menuItem: MenuItem = {
            uid: itemDoc.id,
            name: itemData.name || 'Unnamed Item',
            category: category as string,
            price: Number(itemData.price || 0),
            stock: stock,
            unit: itemData.unit || '',
            description: itemData.description || '',
            // Add any other relevant fields
          }

          return menuItem
        })

        // Add category items to menu items
        menuItems.push(...categoryItems)
      }

      setMenuItems(menuItems)
      setLoading(false)
    } catch (error) {
      setLoading(false)
      toast.error(`Erro ao buscar itens do cardápio: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
    }
  }, [db, user])

  // Ensure fetchMenuItems is called when db and user are available
  useEffect(() => {
    if (db && user) {
      memoizedFetchMenuItems()
    }
  }, [memoizedFetchMenuItems, db, user])

  // Fetch tables
  const fetchTables = async () => {
    if (!db || !user) return

    try {
      // Fetch all table maps for the restaurant
      const tableMapsRef = collection(db, `tableMaps`)
      const tableMapsSnapshot = await getDocs(tableMapsRef)

      const availableTables: { uid: string, mapId: string, number: number }[] = []

      // Iterate through table maps and collect available tables
      tableMapsSnapshot.docs.forEach(mapDoc => {
        const tableMapData = mapDoc.data()
        const tablesInMap = tableMapData?.layout?.tables || []

        const mapAvailableTables = tablesInMap
          .filter((table: TableItem) => 
            table.status === 'available' || 
            table.status === 'ordering'
          )
          .map((table: TableItem) => ({
            uid: table.id,
            mapId: mapDoc.id,
            number: table.name 
              ? parseInt(table.name.replace('Mesa ', ''), 10) 
              : table.number || 0
          }))

        availableTables.push(...mapAvailableTables)
      })

      setTables(availableTables)
      
      if (availableTables.length > 0 && !selectedTable) {
        setSelectedTable(availableTables[0])
      }
    } catch (error) {
      toast.error(`Erro ao buscar mesas: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
    }
  }

  // Type-safe category selection handler
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
  }

  const handleRemoveItem = (index: number) => {
    const updatedItems = [...orderItems]
    updatedItems.splice(index, 1)
    setOrderItems(updatedItems)
    toast.success("Item removido do pedido.")
  }

  // Correct onChange handler for quantity input
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setQuantity(isNaN(value) || value < 1 ? 1 : value);
  }

  // Optional: Method for programmatically updating item quantities
  const updateItemQuantity = (index: number, newQuantity: number) => {
    const updatedItems = [...orderItems];
    updatedItems[index].quantity = newQuantity;
    setOrderItems(updatedItems);
  }

  // Calculate total with robust type handling
  const calculateTotal = (): number => {
    // Ensure we're working with a valid array of items
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return 0
    }

    // Safely calculate total with type coercion and validation
    const subtotal = orderItems.reduce((acc, item) => {
      // Ensure price and quantity are numbers
      const price = Number(item.price || 0)
      const quantity = Number(item.quantity || 1)

      // Calculate item total
      const itemTotal = price * quantity

      // Add to accumulator, ensuring it's a number
      return Number(acc + itemTotal)
    }, 0 as number)

    // Apply any discounts
    if (discount > 0) {
      const discountAmount = discountType === 'percentage'
        ? subtotal * (Number(discount) / 100)
        : Number(discount)

      return Number(Math.max(subtotal - discountAmount, 0))
    }

    return subtotal
  }

  // Validate order details
  const handleSubmit = async () => {
    // Early validation checks
    if (orderItems.length === 0) {
      toast.error("Nenhum item no pedido.")
      return
    }

    try {
      // Prepare order data with safe value handling
      const orderData: Order = {
        createdBy: user.uid,
        id: '', // Will be set by Firestore
        tableId: orderType === 'table' ? (selectedTable?.uid || table?.id || '') : '',
        tableNumber: orderType === 'table'
          ? Number(tableNumber || 0)
          : 0,
        orderType,
        status: 'Pendente' as BaseOrderStatus,
        items: orderItems,
        subtotal: calculateTotal(),
        total: calculateTotal(),
        discount,
        createdAt: new Date(),
        updatedAt: new Date(),
        waiter: user?.username || user?.displayName || 'Unknown',
        uid: user?.uid || 'anonymous',
        paymentInfo: {
          method: 'other' as PaymentMethod,
          amount: calculateTotal(),
          processedAt: new Date()
        },
        closedAt: null,
        ...(specialRequests && { specialRequests }),
        ...(dietaryRestrictions && { dietaryRestrictions }),
        paymentMethod: "other"
      };

      // Use onOrderCreated callback if provided
      if (!onOrderCreated) {
        toast.error("Erro interno: Callback de criação de pedido não fornecida.");
        return;
      }

      await onOrderCreated(orderData);
      
      // Reset form after successful submission
      resetForm();
      
      toast.success("Pedido criado com sucesso!", {
        description: `Total do pedido: R$ ${calculateTotal().toFixed(2)}`
      });

    } catch (error) {
      toast.error("Falha ao criar o pedido.", {
        description: `Erro: ${error}`
      });
    }
  }

  const handleCreateOrder = async () => {
  if (!db || !user) {
    toast.error("Não é possível criar o pedido: falta conexão com o banco de dados ou usuário")
    return
  }

  try {
    setLoading(true);

    // Asegurarse de que tenemos un tableId válido cuando el pedido es para una mesa
    if (orderType === 'table' && !table?.id && !selectedTable?.uid) {
      toast.error("Mesa não selecionada corretamente");
      return;
    }

    // Prepare order object
    const newOrder: Order = {
      id: '', // Will be set by Firestore
      uid: user?.uid || 'anonymous',
      // Usar el ID de la mesa proporcionado por la prop table o selectedTable
      tableId: orderType === 'table' ? (table?.id || selectedTable?.uid || '') : '',
      tableNumber: orderType === 'table'
        ? Number(table?.name || selectedTable?.number || tableNumber || 0)
        : 0,
      orderType,
      status: 'Pendente',
      items: orderItems,
      subtotal: calculateTotal(),
      total: calculateTotal(),
      discount,
      createdAt: new Date(),
      updatedAt: new Date(),
      waiter: user?.username || user?.displayName || 'Unknown',
      paymentInfo: {
        method: 'other' as PaymentMethod,
        amount: calculateTotal(),
        processedAt: new Date()
      },
      closedAt: null,
      ...(specialRequests && { specialRequests }),
      ...(dietaryRestrictions.length > 0 && { dietaryRestrictions }),
      paymentMethod: "other"
    };

    const paymentInfo: PaymentInfo = {
      method: 'other' as PaymentMethod,
      amount: calculateTotal(),
      processedAt: new Date()
    };

    // Call the onOrderCreated callback with the new order
    if (onOrderCreated) {
      await onOrderCreated(newOrder);
      
      // Reset form after successful submission
      resetForm();
      
      toast.success("Pedido criado com sucesso!", {
        description: `Total do pedido: R$ ${calculateTotal().toFixed(2)}`
      });
    }

  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    toast.error(`Erro ao criar pedido: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
  } finally {
    setLoading(false);
  }
}

  // Modify resetForm to handle new state
  const resetForm = () => {
    setOrderItems([])
    setSpecialRequests('')
    setDietaryRestrictions([])
    
    // Safely reset discount with number type
    setDiscount(0 as number)
    setDiscountType("percentage")
    
    // Explicitly type the category to resolve type issues
    setSelectedCategory('') 
    
    setSelectedItem('')
    
    // Ensure quantity is a number
    setQuantity(1 as number)
    
    // Reset order type specific fields
    setOrderType('table')
    
    // Reset table selection if applicable
    setSelectedTable(null)
  }

  // Modify the useEffect to handle category selection more robustly
  useEffect(() => {
    // Set initial category if not set and menu items exist
    if (menuItems.length > 0) {
      // Get unique categories from menu items, filtering out undefined
      const uniqueCategories = Array.from(
        new Set(
          menuItems
            .map(item => item.category)
            .filter((category): category is string => category !== undefined)
        )
      )

      if (uniqueCategories.length > 0) {
        // Set the first category if no category is selected
        if (!selectedCategory) {
          const firstCategory = uniqueCategories[0]
          setSelectedCategory(firstCategory)
        }

        // Optionally set first item in the category
        if (selectedCategory) {
          const firstItemInCategory = menuItems.find(
            item => item.category === selectedCategory
          )
          
          if (firstItemInCategory) {
            setSelectedItem(firstItemInCategory.uid)
          }
        }
      }
    }
  }, [menuItems])

  // Toggle QR Code display
  const toggleQRCode = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent default button behavior if needed
    event.preventDefault()
    
    // Toggle QR Code visibility
    setShowQRCode(!showQRCode)
  }

  // Comprehensive onChange handlers for controlled components
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }

  const handleItemDietaryRestrictionsChange = (restrictions: string[]) => {
    setItemDietaryRestrictions(restrictions);
  }

  const handleMenuUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    // Optional: Add URL validation
    setMenuUrl(url);
  }

  const handleSelectedItemChange = (itemUid: string) => {
    setSelectedItem(itemUid);
    
    // Reset related state when item changes
    const selectedMenuItem = menuItems.find(item => item.uid === itemUid);
    if (selectedMenuItem) {
      setQuantity(1);
      setNotes('');
      setItemDietaryRestrictions([]);
    }
  }

  const handleOrderTypeChange = (value: 'table' | 'counter' | 'takeaway') => {
    setOrderType(value);
  }

  const handleSelectedTableChange = (tableData: {
    uid: string
    mapId: string
    number: number
  } | null) => {
    setSelectedTable(tableData);
  }

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setDiscount(isNaN(value) ? 0 : value);
  }

  const handleDiscountTypeChange = (value: "percentage" | "fixed") => {
    setDiscountType(value);
  }

  const handleSpecialRequestsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // Optional: Add validation if needed
    setSpecialRequests(value);
  }

  const handleDietaryRestrictionsChange = (restrictions: string[]) => {
    // Optional: Add validation if needed
    setDietaryRestrictions(restrictions);
  }

 

  // Render menu items for the selected category
  const renderMenuItems = (): React.ReactNode => {
    // Filter items by selected category
    const filteredItems = menuItems.filter(
      item => item.category === selectedCategory
    )

    if (filteredItems.length === 0) {
      return (
        <div className="text-muted-foreground text-sm">
          Nenhum item nesta categoria.
        </div>
      )
    }

    return (
      <Select 
        value={selectedItem} 
        onValueChange={handleSelectedItemChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione um item" />
        </SelectTrigger>
        <SelectContent>
          {filteredItems.map(item => (
            <SelectItem 
              key={item.uid} 
              value={item.uid}
              // Only disable if category requires stock check AND stock is <= 0
              disabled={!(item.category && CATEGORIES_WITHOUT_STOCK.includes(item.category)) && (item.stock ?? 0) <= 0}
            >
              {item.name} 
              {/* Adjust display logic: Show price if stock is not tracked OR if stock > 0. Show unavailable only if stock is tracked AND <= 0 */}
              {(item.category && CATEGORIES_WITHOUT_STOCK.includes(item.category)) || (item.stock ?? 0) > 0
                ? ` - R$ ${item.price.toFixed(2)}` // Show price if stock not tracked OR if stock > 0
                : " (Indisponível)" // Show unavailable only if stock tracked AND <= 0
              }
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Render category selector
  const renderCategorySelector = (): React.ReactNode => {
    // Get unique categories from menu items, filtering out undefined
    const uniqueCategories = Array.from(
      new Set(
        menuItems
          .map(item => item.category)
          .filter((category): category is string => category !== undefined)
      )
    )

    if (uniqueCategories.length === 0) {
      return (
        <div className="text-muted-foreground text-sm">
          Nenhuma categoria encontrada.
        </div>
      )
    }

    return (
      <Select 
        value={selectedCategory} 
        onValueChange={(value) => setSelectedCategory(value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione uma categoria" />
        </SelectTrigger>
        <SelectContent>
          {uniqueCategories.map(category => (
            <SelectItem 
              key={category} 
              value={category}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Render table selection with counter/takeaway option
  const renderTableSelector = (): React.ReactNode => {
    // If table is passed as a prop, use it
    if (initialTableNumber) {
      function handleTableNumberChange(event: ChangeEvent<HTMLInputElement>): void {
        throw new Error("Function not implemented.")
      }

      return (
        <div className="mb-4">
          <Label>Número da Mesa</Label>
          <Input 
            type="text" 
            onChange={handleTableNumberChange}
            readOnly 
            className="bg-muted cursor-not-allowed" 
            defaultValue={initialTableNumber}
          />
        </div>
      )
    }

    function handleTableNumberChange(event: ChangeEvent<HTMLInputElement>): void {
      setTableNumber(event.target.value);
    }

    // Custom table selection when no table is predefined
    return (
      <div className="space-y-4">
        <div>
          <Label>Tipo de Pedido</Label>
          <Select 
            value={orderType} 
            onValueChange={handleOrderTypeChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o Tipo de Pedido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">Mesa</SelectItem>
              <SelectItem value="counter">Balcão</SelectItem>
              <SelectItem value="takeaway">Retirada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {orderType === 'table' && (
          <div>
            <Label>Número da Mesa</Label>
            <Input 
              type="text" 
              placeholder="Digite o número da mesa" 
              value={tableNumber}
              onChange={handleTableNumberChange}
              className="w-full"
            />
          </div>
        )}
      </div>
    )
  }

  const renderDietaryRestrictions = () => {
    const dietaryOptions = [
      { id: "gluten-free", key: "gluten-free" },
      { id: "lactose-free", key: "lactose-free" },
      { id: "vegan", key: "vegan" },
      { id: "vegetarian", key: "vegetarian" }
    ];

    return (
      <div className="space-y-2">
        {dietaryOptions.map(({ id, key }) => (
          <div key={id} className="flex items-center space-x-2">
            <Checkbox 
              id={id}
              checked={itemDietaryRestrictions.includes(key)}
              onCheckedChange={(checked) => {
                const updatedRestrictions = checked 
                  ? [...itemDietaryRestrictions, key]
                  : itemDietaryRestrictions.filter(r => r !== key);
                handleItemDietaryRestrictionsChange(updatedRestrictions);
              }}
            />
            <Label htmlFor={id}>{dietaryKeyToPortuguese(key)}</Label>
          </div>
        ))}
      </div>
    );
  }

  const renderMenuUrlInput = () => {
    return (
      <div className="space-y-2">
        <Label htmlFor="menu-url">URL do Cardápio (QR Code)</Label>
        <Input 
          id="menu-url"
          type="url"
          placeholder="https://seu-cardapio.com"
          value={menuUrl}
          onChange={handleMenuUrlChange}
          className="w-full"
          pattern="https?://.*"  // Basic URL validation
        />
      </div>
    );
  }

  const renderSpecialRequestsInput = () => {
    return (
      <div className="space-y-2">
        <Label htmlFor="special-requests">Pedidos Especiais</Label>
        <Textarea
          id="special-requests"
          onChange={handleSpecialRequestsChange}
          placeholder="Ex: Sem cebola, ponto da carne mal passado, etc."
          className="resize-y min-h-[100px]"
          maxLength={500}  // Optional: Limit input length
          defaultValue={specialRequests}
        />
      </div>
    );
  }

  const renderDiscountInput = () => {
    return (
      <div className="space-y-2">
        <Label htmlFor="discount">Desconto</Label>
        <div className="flex items-center space-x-2">
          <Input 
            id="discount"
            type="number"
            placeholder="Valor do desconto"
            value={discount}
            onChange={handleDiscountChange}
            className="w-full"
            min="0"
            step="0.01"
            max="100"  // Assuming percentage or fixed amount
          />
          <Select 
            value={discountType}
            onValueChange={(value: "percentage" | "fixed") => {
              setDiscountType(value);
            }}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">%</SelectItem>
              <SelectItem value="fixed">R$</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container px-4 sm:px-6 lg:px-8 max-w-4xl min-h-screen flex flex-col justify-center py-8 ">
      <div className="bg-background border rounded-lg shadow-lg  p-2 overflow-y-auto max-h-[90vh] ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ">
          {/* Left Column: Item Selection */}
          <div className="space-y-4">
            {renderTableSelector()}
            <div>
              <Label>Selecionar Categoria</Label>
              {renderCategorySelector()}
            </div>

            <div>
              <Label>Selecionar Item</Label>
              {renderMenuItems()}
            </div>

            <div>
              <Label>Quantidade</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="text-center flex-grow w-20"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  className="shrink-0"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Observações do Item</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={handleNotesChange}
                placeholder="Ex: Sem picles, ponto bem passado, etc."
                className="resize-y min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Restrições Alimentares do Item</Label>
              {renderDietaryRestrictions()}
            </div>

            <Button type="button" onClick={handleAddItem} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar ao Pedido
            </Button>
          </div>

          {/* Right Column: Order Summary */}
          <div className="space-y-4 bg-muted/50 p-4 rounded-lg w-full ">
            <div className="flex flex-col gap-2 items-center">
              <div className="flex justify-end items-center w-full">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleQRCode}
                  className="text-xs flex items-center w-full"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  {showQRCode ? 'Esconder QR Code do Cardápio' : 'Mostrar QR Code do Cardápio'}
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Resumo do Pedido</h2>
              </div>
            </div>

            {showQRCode && (
              <div className="flex flex-col items-center space-y-4 mt-4">
                
                <QRCode 
                  value={menuUrl} 
                  size={256} 
                  level={'H'} 
                  includeMargin={true} 
                />
              </div>
            )}

            {orderItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>Nenhum item no pedido.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="max-h-[50vh] overflow-y-auto space-y-2">
                  {orderItems.map((item, index) => (
                    <div 
                      key={`${item.id}-${index}`} 
                      className="border rounded-lg p-4 bg-background flex justify-between items-center"
                    >
                      <div className="flex-grow">
                        <div className="flex justify-between items-center">
                          <div>
                            <span>{item.name}</span>
                            {(item.isVegetarian || item.isVegan || item.isGlutenFree || item.isLactoseFree) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Restrições: {[
                                  item.isVegetarian && dietaryKeyToPortuguese("vegetarian"),
                                  item.isVegan && dietaryKeyToPortuguese("vegan"),
                                  item.isGlutenFree && dietaryKeyToPortuguese("gluten-free"),
                                  item.isLactoseFree && dietaryKeyToPortuguese("lactose-free")
                                ].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                const updatedItems = [...orderItems]
                                updatedItems[index].quantity = Math.max(1, updatedItems[index].quantity - 1)
                                setOrderItems(updatedItems)
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span>{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                const updatedItems = [...orderItems]
                                updatedItems[index].quantity += 1
                                setOrderItems(updatedItems)
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm">
                              R$ {item.price.toFixed(2)} / un
                            </div>
                            <div className="font-semibold">
                              R$ {(item.price * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold">
                      R$ {orderItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Desconto</Label>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={discountType} 
                        onValueChange={handleDiscountTypeChange}
                      >
                        <SelectTrigger className="w-[50px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">R$</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={discount}
                        onChange={handleDiscountChange}
                        min="0"
                        className="w-[100px]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span>Total</span>
                    <span className="text-xl font-bold">
                      R$ {calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              {renderSpecialRequestsInput()}
            </div>

            

            <div>
              {renderMenuUrlInput()}
            </div>

            <div>
              {renderDiscountInput()}
            </div>

            <div className="flex justify-end space-x-2 mt-4">
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button 
                onClick={handleCreateOrder} 
                className="w-full" 
                disabled={orderItems.length === 0 || (orderType === 'table' && !tableNumber.trim())}
              >
                Criar Pedido
              </Button>
              {orderItems.length === 0 && (
                <p className="text-sm text-red-500 mt-2">
                  Nenhum item no pedido.
                </p>
              )}
              {(orderType === 'table' && !tableNumber.trim()) && (
                <p className="text-sm text-red-500 mt-2">
                  Nenhuma mesa selecionada para pedido na mesa.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
