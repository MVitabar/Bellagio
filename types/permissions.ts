import { UserRole } from './user';

export interface Permission {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface ModulePermissions {
  profile: Permission;
  language: Permission;
  appearance: Permission;
  notifications: Permission;
  'users-management': Permission;
  dashboard: Permission;
  orders: Permission;
  tables: Permission;
  inventory: Permission;
  settings: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    sections?: {
      profile: boolean;
      appearance: boolean;
      language: boolean;
      notifications: boolean;
      company: boolean;
      security: boolean;
      billing: boolean;
    };
  };
  reports: Permission;
}

export const ROLE_PERMISSIONS: Record<UserRole, ModulePermissions> = {
  [UserRole.OWNER]: {
    profile: { view: true, create: true, update: true, delete: true },
    language: { view: true, create: true, update: true, delete: true },
    appearance: { view: true, create: true, update: true, delete: true },
    notifications: { view: true, create: true, update: true, delete: true },
    'users-management': { view: true, create: true, update: true, delete: true },
    dashboard: { view: true, create: true, update: true, delete: true },
    orders: { view: true, create: true, update: true, delete: true },
    tables: { view: true, create: true, update: true, delete: true },
    inventory: { view: true, create: true, update: true, delete: true },
    settings: {
      view: true,
      create: true,
      update: true,
      delete: true,
      sections: {
        profile: true,
        appearance: true,
        language: true,
        notifications: true,
        company: true,
        security: true,
        billing: true
      }
    },
    reports: { view: true, create: true, update: true, delete: true }
  },
  [UserRole.ADMIN]: {
    profile: { view: true, create: true, update: true, delete: false },
    language: { view: true, create: true, update: true, delete: true },
    appearance: { view: true, create: true, update: true, delete: true },
    notifications: { view: true, create: true, update: true, delete: true },
    'users-management': { view: true, create: true, update: true, delete: false }, // No puede eliminar usuarios
    dashboard: { view: true, create: true, update: true, delete: true },
    orders: { view: true, create: true, update: true, delete: true },
    tables: { view: true, create: true, update: true, delete: true },
    inventory: { view: true, create: true, update: true, delete: false },
    reports: { view: true, create: true, update: false, delete: false },
    settings: {
      view: true,
      create: false,
      update: true,
      delete: false,
      sections: {
        profile: true,
        appearance: true,
        language: true,
        notifications: true,
        company: true,
        security: false,
        billing: false
      }
    }
  },

  [UserRole.MANAGER]: {
    profile: { view: true, create: false, update: true, delete: false },
    language: { view: true, create: true, update: true, delete: true },
    appearance: { view: true, create: true, update: true, delete: true },
    notifications: { view: true, create: true, update: true, delete: true },
    'users-management': { view: true, create: false, update: false, delete: false },
    dashboard: { view: true, create: false, update: false, delete: false },
    orders: { view: true, create: true, update: true, delete: true },
    tables: { view: true, create: true, update: true, delete: true },
    inventory: { view: true, create: true, update: true, delete: false },
    reports: { view: true, create: true, update: false, delete: false },
    settings: {
      view: true,
      create: false,
      update: true,
      delete: false,
      sections: {
        profile: true,
        appearance: true,
        language: true,
        notifications: true,
        company: false,
        security: false,
        billing: false
      }
    }
  },

  [UserRole.CHEF]: {
    profile: { view: true, create: false, update: true, delete: false },
    language: { view: true, create: true, update: true, delete: true },
    appearance: { view: true, create: true, update: true, delete: true },
    notifications: { view: true, create: true, update: true, delete: true },
    'users-management': { view: false, create: false, update: false, delete: false },
    dashboard: { view: false, create: false, update: false, delete: false },
    orders: { view: true, create: false, update: true, delete: false },
    tables: { view: true, create: false, update: false, delete: false },
    inventory: { view: true, create: false, update: true, delete: false },
    reports: { view: false, create: false, update: false, delete: false },
    settings: {
      view: true,
      create: false,
      update: true,
      delete: false,
      sections: {
        profile: true,
        appearance: true,
        language: true,
        notifications: true,
        company: false,
        security: false,
        billing: false
      }
    }
  },
  [UserRole.BARMAN]: {
    profile: { view: true, create: false, update: false, delete: false },
    language: { view: true, create: false, update: false, delete: false },
    appearance: { view: true, create: false, update: false, delete: false },
    notifications: { view: true, create: false, update: false, delete: false },
    'users-management': { view: false, create: false, update: false, delete: false },
    dashboard: { view: false, create: false, update: false, delete: false },
    orders: { view: true, create: false, update: true, delete: false },
    tables: { view: true, create: false, update: false, delete: false },
    inventory: { view: true, create: false, update: false, delete: false },
    reports: { view: false, create: false, update: false, delete: false },
    settings: {
      view: true,
      create: false,
      update: true,
      delete: false,
      sections: {
        profile: true,
        appearance: true,
        language: true,
        notifications: true,
        company: false,
        security: false,
        billing: false,
      }
    }
  },

  [UserRole.WAITER]: {
    profile: { view: true, create: false, update: true, delete: false },
    language: { view: true, create: true, update: true, delete: true },
    appearance: { view: true, create: true, update: true, delete: true },
    notifications: { view: true, create: true, update: true, delete: true },
    'users-management': { view: false, create: false, update: false, delete: false },
    dashboard: { view: false, create: false, update: false, delete: false },
    orders: { view: true, create: true, update: true, delete: false },
    tables: { view: true, create: true, update: true, delete: false },
    inventory: { view: false, create: false, update: false, delete: false },
    reports: { view: false, create: false, update: false, delete: false },
    settings: {
      view: true,
      create: false,
      update: true,
      delete: false,
      sections: {
        profile: true,
        appearance: true,
        language: true,
        notifications: true,
        company: false,
        security: false,
        billing: false
      }
    }
  }
};

export function hasPermission(
  role: UserRole,
  module: keyof ModulePermissions,
  action: keyof Permission
): boolean {
  // Si es OWNER, siempre tiene permisos
  if (role === UserRole.OWNER) return true;
  
  // Para otros roles, verificar en ROLE_PERMISSIONS
  return ROLE_PERMISSIONS[role]?.[module]?.[action] ?? false;
}

export interface PermissionProps {
  requiredView?: keyof ModulePermissions;
  requiredAction?: keyof Permission;
  // También podrías necesitar el módulo específico si la acción no es suficiente
  // requiredModuleForAction?: keyof ModulePermissions; 
}

export { UserRole };
