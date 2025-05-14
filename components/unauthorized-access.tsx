import { AlertTriangle } from "lucide-react";

export function UnauthorizedAccess() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-2xl font-semibold mb-2">
        Acesso Não Autorizado
      </h2>
      <p className="text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </p>
    </div>
  );
}