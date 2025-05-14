import router from "next/router";
import { Button } from "./ui/button";

// components/unauthorized.tsx
export function UnauthorizedAccess() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1>Acceso No Autorizado</h1>
      <p>No tienes permisos para ver esta página</p>
      <Button onClick={() => router.push('/')}>
        Volver al Inicio
      </Button>
    </div>
  )
}