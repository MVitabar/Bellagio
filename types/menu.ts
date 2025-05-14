// Menu and Dietary Restrictions
// Remove the MenuItemCategory enum as categories are now dynamic strings
/*
export enum MenuItemCategory {
  Refrigerantes = 'Refrigerantes',
  Drinks = 'Drinks',
  Cervejas = 'Cervejas',
  Vinhos = 'Vinhos',
  Acompanhamentos = 'Acompanhamentos',
  Almoco = 'Almoco',
  Jantar = 'Jantar'
}
*/

export interface DietaryRestriction {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  lactoseFree: boolean;
  nutFree?: boolean;
  shellfishFree?: boolean;
  eggFree?: boolean;
}

export interface MenuItem {
  uid: string;
  name: string;
  price: number;
  // Update category to be a string
  category?: string; 
  description?: string;
  available?: boolean;
  image?: string;
  unit?: string;
  stock?: number;
  minimumStock?: number;
  dietaryInfo?: DietaryRestriction;
}
