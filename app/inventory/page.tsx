"use client"

import type React from "react"
import { InventoryItem } from "@/types"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/components/auth-provider"
import { 
  collection, 
  query, 
  where,
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp,
} from "firebase/firestore"
import { useFirebase } from '@/components/firebase-provider'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Plus, Search, AlertTriangle, Edit, Trash2, PlusCircle } from "lucide-react"
import { usePermissions } from "@/components/permissions-provider"
import { UnauthorizedAccess } from "@/components/unauthorized-access"
import { useNotifications } from "@/hooks/useNotifications"
import { toast } from "sonner"
import { CATEGORIES_WITHOUT_STOCK } from "@/lib/constants"; // Import from shared location
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

export default function InventoryPage() {
  const { user } = useAuth()
  const { canView, canCreate, canUpdate, canDelete } = usePermissions()
  const { sendNotification } = useNotifications()
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Inventory Item Management State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')

  // State for categories
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true);

  // State for Delete Confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // State for Add Stock Dialog
  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = useState(false);
  const [itemToAddStockTo, setItemToAddStockTo] = useState<InventoryItem | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState<string>(""); // Use string for input control

  // Form State
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    category: '',
    quantity: 0,
    unit: '',
    price: 0,
    minQuantity: 0,
    description: '',
    supplier: '',
  })

  const { db } = useFirebase()

  // Fetch Categories for the dropdown
  const fetchCategories = async () => {
    if (!db) return;
    setLoadingCategories(true);
    try {
      const inventoryCollectionRef = collection(db, 'inventory');
      // Assuming categories might have _isCategory: true, or simply fetch all top-level docs if that defines a category.
      // For now, let's assume any doc in 'inventory' root is a category if we simplify.
      // Or, if you add _isCategory: true to category docs during creation:
      const q = query(inventoryCollectionRef, where("_isCategory", "==", true), orderBy("name"));
      // If not using _isCategory, and all docs in inventory root are categories:
      // const q = query(inventoryCollectionRef, orderBy("name"));

      const querySnapshot = await getDocs(q);
      const fetchedCategories = querySnapshot.docs.map(doc => ({
        id: doc.id, // e.g., "refrigerantes"
        name: doc.data().name || doc.id // e.g., "Refrigerantes"
      }));
      setCategories(fetchedCategories);
    } catch (err) {
      console.error("Error fetching categories:", err);
      toast.error("Erro ao buscar categorias"); // Add a translation for this
    }
    setLoadingCategories(false);
  };

  // Fetch Inventory Items (Refactored for Option B)
  const fetchInventoryItems = async () => {
    if (!db || categories.length === 0) { // Wait for db and categories
      // If categories are not yet loaded, this function might be called too early by useEffect.
      // It will be re-called when categories state updates if categories is in useEffect dependency array (it's not directly, but user is).
      // Or, ensure fetchCategories has completed.
      // For now, if categories is empty, we can either return or wait. Let's return and let useEffect re-trigger if needed.
      if (categories.length === 0 && !loadingCategories) {
        // If categories are finished loading and still none, then there are no categories to fetch items from.
        setInventoryItems([]);
        setLoading(false);
        return;
      } 
      if (loadingCategories) return; // Still loading categories, wait.
    }

    setLoading(true);
    setError(null);
    try {
      const itemsPromises = categories.map(async (category) => {
        const itemsRef = collection(db, 'inventory', category.id, 'items');
        const itemsQuery = query(itemsRef, orderBy('name'));
        
        try {
          const itemsSnapshot = await getDocs(itemsQuery);
          return itemsSnapshot.docs.map(itemDoc => {
            const itemData = itemDoc.data();
            return {
              uid: itemDoc.id, // Firestore document ID of the item
              id: itemDoc.id, // spesso uid e id sono usati in modo intercambiabile, assicurati coerenza
              category: category.id, // Store the category ID
              name: itemData.name || '',
              quantity: itemData.quantity === undefined ? null : itemData.quantity, // Handle undefined quantity
              unit: itemData.unit || '',
              price: itemData.price === undefined ? null : itemData.price, // Handle undefined price
              minQuantity: itemData.minQuantity === undefined ? null : itemData.minQuantity, // Handle undefined minQuantity
              description: itemData.description || '',
              supplier: itemData.supplier || '',
              // Ensure Timestamps are handled correctly, converting to Date if necessary
              createdAt: itemData.createdAt?.toDate ? itemData.createdAt.toDate() : new Date(), 
              updatedAt: itemData.updatedAt?.toDate ? itemData.updatedAt.toDate() : new Date(),
            } as InventoryItem;
          });
        } catch (categoryErr) {
          console.error(`Error fetching items for category ${category.name} (ID: ${category.id}):`, categoryErr);
          // Optionally, notify the user for this specific category error
          toast.error("Erro ao buscar itens da categoria"); // Add translation
          return []; // Return empty array for this category on error
        }
      });

      const allItemsArrays = await Promise.all(itemsPromises);
      const flattenedItems = allItemsArrays.flat();

      setInventoryItems(flattenedItems);
    } catch (err) {
      console.error("Error fetching inventory items:", err);
      setError("Erro ao buscar itens do inventário"); // Add translation
    } finally {
      setLoading(false);
    }
  };

  // Verificar si el usuario puede ver el inventario
  if (!canView('inventory')) {
    return <UnauthorizedAccess />
  }

  // Initialize data fetch
  useEffect(() => {
    if (user) {
      // fetchCategories will update 'categories' state. 
      // We need fetchInventoryItems to run *after* categories are available.
      fetchCategories();
    }
  }, [user]); // Initial fetch trigger

  useEffect(() => {
    if (user && categories.length > 0 && !loadingCategories) {
      // If user is present, and categories have been loaded
      fetchInventoryItems();
    }
    // Also, if categories finish loading and there are none, we might want to clear items or show a message.
    if (user && !loadingCategories && categories.length === 0) {
      setInventoryItems([]); // No categories, so no items
      setLoading(false); // Stop loading indicator for items
    }
  }, [user, categories, loadingCategories]); // Re-fetch items if categories change or finish loading

  // Add/Edit Inventory Item
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    // --- Validation --- 
    const categoryId = formData.category;
    if (!categoryId) {
      toast.error("Erro", { description: "Selecione uma categoria" });
      return;
    }
    // Existing validation for name, unit, price (conditionally)
    if (!formData.name || !formData.unit || 
        (!CATEGORIES_WITHOUT_STOCK.includes(categoryId) && (formData.price === undefined || formData.price === null))) { // Adjusted check
      toast.error("Erro", { description: "Preencha todos os campos obrigatórios" });
      return;
    }

    const isEditing = dialogMode === 'edit' && selectedItem;
    const requiresStock = !CATEGORIES_WITHOUT_STOCK.includes(categoryId);

    // --- Prepare Data --- 
    // Base data common to add and edit
    const dataToSave: { [key: string]: any } = { 
      name: formData.name?.trim(),
      category: categoryId, // Store category ID on the item itself
      unit: formData.unit?.trim(),
      // Include optional fields only if they have a value
      ...(formData.description && { description: formData.description.trim() }),
      ...(formData.supplier && { supplier: formData.supplier.trim() }),
      updatedAt: serverTimestamp(), // Always update timestamp
    };

    // Add price only if NOT a category without stock
    if (requiresStock) { // Or check categoryId directly if simpler
      // Use null if undefined/null, otherwise use the number value
      dataToSave.price = formData.price === undefined || formData.price === null ? null : Number(formData.price);
      // Ensure quantity and minQuantity are numbers or null
      dataToSave.quantity = formData.quantity === undefined || formData.quantity === null ? null : Number(formData.quantity);
      dataToSave.minQuantity = formData.minQuantity === undefined || formData.minQuantity === null ? null : Number(formData.minQuantity);
    } else {
      // For categories WITHOUT stock, still save the price entered, but set quantity/minQuantity to null
      dataToSave.price = formData.price === undefined || formData.price === null ? null : Number(formData.price);
      dataToSave.quantity = null;
      dataToSave.minQuantity = null;
    }

    // --- Firestore Operation --- 
    try {
      setLoading(true); // Indicate loading during Firestore operation

      if (isEditing && selectedItem) {
        // --- UPDATE --- 
        // ** Important: Assuming category does NOT change during edit. ** 
        // If category could change, logic would need to delete old doc and add new.
        if (selectedItem.category !== categoryId) {
            toast.error("Erro", { description: "Não é possível alterar a categoria de um item existente" }); // Add translation
            setLoading(false);
            return;
        }
        
        // Ensure selectedItem has a valid string ID before using it in doc path
        if (typeof selectedItem.id !== 'string' || selectedItem.id === '') {
          console.error("Selected item for edit is missing a valid ID:", selectedItem);
          toast.error("Erro", { description: "Item selecionado para edição não tem um ID válido" }); // Add translation
          setLoading(false);
          return;
        }

        const itemDocRef = doc(db, 'inventory', categoryId, 'items', selectedItem.id);
        await updateDoc(itemDocRef, dataToSave);
        toast.success("Item atualizado com sucesso!");
        // Optional: Send notification
        sendNotification({
          message: `Item "${dataToSave.name}" atualizado com sucesso`,
          title: ""
        });
      } else {
        // --- ADD --- 
        const itemsCollectionRef = collection(db, 'inventory', categoryId, 'items');
        // Add createdAt timestamp only when creating
        dataToSave.createdAt = serverTimestamp(); 
        await addDoc(itemsCollectionRef, dataToSave);
        toast.success("Item adicionado com sucesso!");
        // Optional: Send notification
        sendNotification({
          message: `Item "${dataToSave.name}" adicionado com sucesso`,
          title: ""
        });
      }

      // --- Post-Save --- 
      setIsDialogOpen(false); // Close dialog
      fetchInventoryItems(); // Refresh the list

    } catch (error) {
      console.error("Error saving inventory item:", error);
      toast.error("Erro", { 
        description: isEditing ? "Erro ao atualizar item" : "Erro ao adicionar item"
      });
    } finally {
      setLoading(false); // Stop loading indicator
    }
  };

  // Confirm Delete Inventory Item
  const confirmDelete = async () => {
    if (!itemToDelete || !itemToDelete.id || !itemToDelete.category || !db) {
      console.error("Item to delete is missing required information or db is not available.", { itemToDelete, db });
      toast.error("Erro", { description: "Item para exclusão está faltando informações ou banco de dados indisponível" }); // Add translation
      // Reset state defensively
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      return;
    }

    const { id: itemId, category: categoryId, name: itemName } = itemToDelete;

    try {
      // Construct the correct path to the item within its category subcollection
      const itemRef = doc(db, 'inventory', categoryId, 'items', itemId);
      await deleteDoc(itemRef)
      
      setInventoryItems(prev => prev.filter(item => item.uid !== itemId))
      
      toast.success("Item excluído com sucesso!", {
        description: `Item "${itemName}" excluído com sucesso.`,
      })

      // Notify based on the item name we stored before deleting
      await sendNotification({
        title: "Item Excluído",
        message: `Item "${itemName}" excluído com sucesso.`,
        url: window.location.href,
      });
    } catch (err) {
      console.error("Error deleting inventory item:", err)
      toast.error("Erro", {
        description: "Erro ao excluir item",
      })
    }
  }

  // Open Delete Confirmation Dialog
  const openDeleteDialog = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  // Open Add Stock Dialog
  const openAddStockDialog = (item: InventoryItem) => {
    setItemToAddStockTo(item);
    setQuantityToAdd(""); // Reset quantity input
    setIsAddStockDialogOpen(true);
  };

  // Handle Add Stock Dialog Submission
  const handleAddStockSubmit = async () => {
    if (!itemToAddStockTo || !itemToAddStockTo.id || !itemToAddStockTo.category || !db) {
      console.error("Add stock target item missing info or db unavailable", { itemToAddStockTo, db });
      toast.error("Erro", { description: "Item para adicionar estoque está faltando informações ou banco de dados indisponível" }); // Add translation
      return;
    }

    const numericQuantityToAdd = Number(quantityToAdd);
    if (isNaN(numericQuantityToAdd) || numericQuantityToAdd <= 0) {
      toast.error("Erro", { description: "Por favor, insira uma quantidade válida maior que zero" }); // Add translation
      return;
    }

    const { id: itemId, category: categoryId, name: itemName, quantity: currentStockRaw } = itemToAddStockTo;
    const currentStock = typeof currentStockRaw === 'number' ? currentStockRaw : 0; // Default to 0 if null/undefined
    const newQuantity = currentStock + numericQuantityToAdd;

    try {
      // Consider adding a loading state here if the update takes time
      const itemRef = doc(db, 'inventory', categoryId, 'items', itemId);
      await updateDoc(itemRef, {
        quantity: newQuantity,
        updatedAt: serverTimestamp(),
      });

      // Update local state immediately for better UX
      setInventoryItems(prevItems => 
        prevItems.map(item => 
          item.uid === itemId ? { ...item, quantity: newQuantity } : item
        )
      );

      toast.success("Estoque adicionado com sucesso!", { 
        description: `Adicionado ${numericQuantityToAdd} a "${itemName}". Novo total: ${newQuantity}.`,
      });

      // Close dialog and reset
      setIsAddStockDialogOpen(false);
      setItemToAddStockTo(null);
      setQuantityToAdd("");

    } catch (error) {
      console.error("Error adding stock:", error);
      toast.error("Erro", { description: "Falha ao adicionar estoque ao item" }); // Add translation
    } finally {
      // Stop loading state here if you added one
    }
  };

  // Filtered and Sorted Inventory
  const filteredInventory = useMemo(() => {
    // Usar spread (...) para no mutar el array original
    // Ordenar ascendente por cantidad, tratando undefined como 0
    return [...inventoryItems].sort((a, b) => 
      (a.quantity ?? 0) - (b.quantity ?? 0) 
    )
  }, [inventoryItems])

  // Low Stock Items
  const lowStockItems = useMemo(() => {
    return inventoryItems.filter(item => 
      // Solo incluir items que SÍ tienen cantidad definida
      typeof item.quantity === 'number' && 
      // Comparar con minQuantity (o 0 si minQuantity es undefined)
      item.quantity <= (item.minQuantity ?? 0) 
    )
  }, [inventoryItems])

  // First, create a function to check if user can perform any actions
  const canPerformActions = canUpdate('inventory') || canDelete('inventory');

  useEffect(() => {
    // Notificar productos con bajo stock
    if (lowStockItems.length > 0) {
      toast.warning(`${lowStockItems.length} produtos com baixo estoque`)

      // Notificação push solo si hay items críticos
      const criticalItems = lowStockItems.filter(item => 
        typeof item.quantity === 'number' && 
        item.quantity <= (item.minQuantity ?? 0) / 2
      )
      if (criticalItems.length > 0) {
        sendNotification({
          title: "Alerta de Estoque!",
          message: `${criticalItems.length} produtos requerem atenção imediata`,
          url: '/inventory'
        })
      }
    }
  }, [lowStockItems])

  const handleCategoryChange = (value: string) => {
    const selectedCategory = value;
    const shouldResetQuantities = CATEGORIES_WITHOUT_STOCK.includes(selectedCategory);
    setFormData(prev => ({
      ...prev, 
      category: selectedCategory,
      ...(shouldResetQuantities && { quantity: undefined, minQuantity: undefined }) // Resetea si cambia a sin stock
    }));
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Inventário</CardTitle>
              <CardDescription>Gerencie seus itens de estoque</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                {canCreate('inventory') && (
                  <Button 
                    onClick={() => {
                      setDialogMode('add')
                      setFormData({})
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Item
                  </Button>
                )}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {dialogMode === 'add' 
                      ? "Adicionar Novo Item" 
                      : "Editar Item"
                    }
                  </DialogTitle>
                  <DialogDescription>
                    {dialogMode === 'add' 
                      ? "Adicione um novo item ao seu estoque" 
                      : "Edite um item existente"
                    }
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Form fields for inventory item */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={formData.name || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev, 
                          name: e.target.value
                        }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={formData.category || ''}
                        onValueChange={handleCategoryChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Add your categories here */}
                          {categories.map(category => (
                            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Conditional quantity fields */}
                  {!CATEGORIES_WITHOUT_STOCK.includes(formData.category ?? '') && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            value={formData.quantity || 0}
                            onChange={(e) => setFormData(prev => ({
                              ...prev, 
                              quantity: Number(e.target.value)
                            }))}
                            type="number"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Estoque Mínimo</Label>
                          <Input
                            value={formData.minQuantity || 0}
                            onChange={(e) => setFormData(prev => ({
                              ...prev, 
                              minQuantity: Number(e.target.value)
                            }))}
                            type="number"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {/* Conditional Price Field */}
                  {formData.category !== 'acompanhamentos' && (
                    <div className="space-y-2">
                      <Label>Preço</Label>
                      <Input
                        value={formData.price || 0}
                        onChange={(e) => setFormData(prev => ({
                          ...prev, 
                          price: Number(e.target.value)
                        }))}
                        type="number"
                        step="0.01"
                        required // Mantenemos 'required' aquí, pero la validación lo ignorará si es acompanamiento
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Input 
                      value={formData.unit || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev, 
                        unit: e.target.value
                      }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input 
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev, 
                        description: e.target.value
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fornecedor</Label>
                    <Input 
                      value={formData.supplier || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev, 
                        supplier: e.target.value
                      }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">
                      {dialogMode === 'add' 
                        ? "Adicionar" 
                        : "Atualizar"
                      }
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex items-center">
                <AlertTriangle className="mr-2 text-yellow-600" />
                <p className="text-yellow-800">
                  {lowStockItems.length} produtos com baixo estoque
                </p>
              </div>
              <ul className="space-y-2">
                {lowStockItems.map((item) => (
                  <li key={item.uid} className="text-sm">
                    {item.name}: {typeof item.quantity === 'number' ? item.quantity : '-'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Inventory Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead className="hidden sm:table-cell">Unidade</TableHead>
                {/* Only show actions column if user has permissions */}
                {canPerformActions && (
                  <TableHead>Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => (
                <TableRow key={item.uid}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{categories.find(c => c.id === item.category)?.name || item.category}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        // Comprobar si quantity es un número ANTES de comparar
                        typeof item.quantity === 'number' && item.quantity <= (item.minQuantity ?? 0) 
                          ? "destructive" 
                          : "default" // Variante por defecto si no hay cantidad o no está bajo stock
                      }
                    >
                      {typeof item.quantity === 'number' ? item.quantity : '-'} {item.unit}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{item.unit}</TableCell>
                  {/* Only show actions cell if user has permissions */}
                  {canPerformActions && (
                    <TableCell>
                      <div className="flex space-x-2">
                        {canUpdate('inventory') && (
                          <Button 
                            title="Editar Item"
                            size="icon" 
                            variant="outline"
                            onClick={() => {
                              setSelectedItem(item)
                              setFormData(item)
                              setDialogMode('edit')
                              setIsDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete('inventory') && (
                          <Button 
                            size="icon" 
                            variant="destructive"
                            onClick={() => openDeleteDialog(item)} // Open confirmation dialog
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Add Stock Button - Only if item tracks stock AND user can update */}
                        {canUpdate('inventory') && !CATEGORIES_WITHOUT_STOCK.includes(item.category ?? '') && (
                           <Button 
                            title="Adicionar Estoque"
                            size="icon" 
                            variant="ghost" // Or another variant
                            onClick={() => openAddStockDialog(item)}
                           >
                            <PlusCircle className="h-4 w-4" />
                           </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {`Tem certeza de que deseja excluir o item "${itemToDelete?.name || ''}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Stock Dialog */}
      <Dialog open={isAddStockDialogOpen} onOpenChange={(open) => {
        setIsAddStockDialogOpen(open);
        if (!open) { // Reset state if dialog is closed without submitting
          setItemToAddStockTo(null);
          setQuantityToAdd("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Adicionar Estoque a "${itemToAddStockTo?.name || ''}"`}</DialogTitle>
            <DialogDescription>
              {`Estoque atual: ${itemToAddStockTo?.quantity ?? 0}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity-to-add">Quantidade a Adicionar</Label>
              <Input 
                id="quantity-to-add"
                type="number"
                value={quantityToAdd}
                onChange={(e) => setQuantityToAdd(e.target.value)}
                min="1"
                placeholder="Insira a quantidade"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStockDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddStockSubmit}>Adicionar Estoque</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}