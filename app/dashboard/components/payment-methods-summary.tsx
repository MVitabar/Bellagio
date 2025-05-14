import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface PaymentMethod {
  method: string
  count: number
  percentage: number
}

interface PaymentMethodsSummaryProps {
  methods: PaymentMethod[]
}

export function PaymentMethodsSummary({ methods }: PaymentMethodsSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Métodos de Pagamento</CardTitle>
        <CardDescription>Estatísticas de uso</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {methods.map((method) => (
            <div key={method.method} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{method.method}</p>
                <span className="text-sm text-muted-foreground">
                  {method.count} pedidos ({method.percentage.toFixed(1)}%)
                </span>
              </div>
              <Progress value={method.percentage} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
