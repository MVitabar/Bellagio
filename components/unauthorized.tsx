import router from "next/router";
import { Button } from "./ui/button";

// components/unauthorized.tsx
export function UnauthorizedAccess() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1>Acesso Não Autorizado</h1>
      <p> Não tem permissão para acessar esta página</p>
      <Button onClick={() => router.push('/')}>
        Voltar ao Início
      </Button>
    </div>
  )
}