import { useContext } from 'react';
import { UserRole } from '@/types';
import { ModulePermissions, Permission, hasPermission } from '@/types/permissions';
import { useAuth } from './useAuth';

export function usePermissions() {
  const { user } = useAuth();

  const checkPermission = (
    module: keyof ModulePermissions,
    action: keyof Permission
  ): boolean => {
    if (!user || !user.role) {
      return false;
    }

    // Si es OWNER, dar acceso total
    if (user.role === UserRole.OWNER) {
      return true;
    }

    const permissionGranted = hasPermission(user.role, module, action);
    return permissionGranted;
  };

  return {
    canView: (module: keyof ModulePermissions) => checkPermission(module, 'view'),
    canCreate: (module: keyof ModulePermissions) => checkPermission(module, 'create'),
    canUpdate: (module: keyof ModulePermissions) => checkPermission(module, 'update'),
    canDelete: (module: keyof ModulePermissions) => checkPermission(module, 'delete'),
  };
}
