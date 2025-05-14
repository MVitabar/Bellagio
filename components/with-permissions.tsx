// components/with-permissions.tsx
import React, { ComponentType } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { UnauthorizedAccess } from './unauthorized'
import { ModulePermissions, PermissionProps } from '@/types';

export function withPermissions<P extends object>(
  WrappedComponent: ComponentType<P>, 
  { requiredView, requiredAction }: PermissionProps = {}
) {
  return function PermissionWrapper(props: P) {
    const { canView, canDo } = usePermissions() as { canView: (module: string | number) => boolean; canDo?: (module: string | number, action: string) => boolean }

    // Verificar permisos de vista
    if (requiredView && !canView(requiredView)) {
      return <UnauthorizedAccess />
    }

    // Verificar permisos de acción
    if (requiredAction) {
      if (typeof canDo === 'function') {
        const moduleName: string = requiredView !== undefined ? String(requiredView) : '';
        if (!canDo(moduleName as string, requiredAction as string)) {
          return <UnauthorizedAccess />
        }
      } else {
        return <UnauthorizedAccess />
      }
    }

    // Agregar llave de cierre para la función PermissionWrapper
    // y mover el return <WrappedComponent {...props} /> dentro de ella
    return <WrappedComponent {...props} />
  }
}

// Ejemplo de uso con un componente genérico
const ExampleProtectedComponent: React.FC = () => {
  return <div>Componente Protegido</div>
}

// Ejemplo de componente protegido para creación de pedidos
export const ProtectedOrderCreation = withPermissions(
  ExampleProtectedComponent, 
  {
    requiredView: 'orders',
    requiredAction: 'createOrder'
  }
)

// Ejemplo de uso como decorador
export function ProtectedRoute(
  requiredView?: string, 
  requiredAction?: string
) {
  return function(
    target: any, 
    propertyKey: string, 
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = function(...args: any[]) {
      const { canView, canDo } = usePermissions() as { canView: (module: string | number) => boolean; canDo?: (module: string | number, action: string) => boolean }

      if (requiredView && !canView(requiredView)) {
        return <UnauthorizedAccess />
      }

      if (requiredAction) {
        if (typeof canDo === 'function') {
          const moduleName: string = requiredView !== undefined ? String(requiredView) : '';
          if (!canDo(moduleName, requiredAction)) {
            return <UnauthorizedAccess />
          }
        } else {
          return <UnauthorizedAccess />
        }
      }

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}