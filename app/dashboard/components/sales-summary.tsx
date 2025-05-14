import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Clock, DollarSign } from "lucide-react"

interface SalesSummaryProps {
  todayTotal: number
  yesterdayTotal: number
  averageTicket: number
  peakHours: { hour: number; sales: number }[]
  topProfitItems: { name: string; profit: number }[]
}

export function SalesSummary({ 
  todayTotal, 
  yesterdayTotal, 
  averageTicket,
  peakHours,
  topProfitItems
}: SalesSummaryProps) {
  const percentageChange = yesterdayTotal > 0 
    ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
    : todayTotal > 0 ? 100 : 0;
  const isPositiveChange = percentageChange >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo Diário</CardTitle>
        <CardDescription>Análise comparativa e métricas chave</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Comparación con ayer */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Comparação com ontem</p>
              <p className="text-2xl font-bold">
                {isPositiveChange ? "+" : ""}{percentageChange.toFixed(1)}%
              </p>
            </div>
            {isPositiveChange ? 
              <TrendingUp className="h-8 w-8 text-green-500" /> : 
              <TrendingDown className="h-8 w-8 text-red-500" />
            }
          </div>

          {/* Ticket promedio */}
          <div>
            <p className="text-sm text-muted-foreground">Ticket Médio</p>
            <p className="text-xl font-semibold">R$ {averageTicket.toFixed(2)}</p>
          </div>

          {/* Horas pico */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Horários de Pico</p>
            <div className="space-y-2">
              {peakHours.slice(0, 3).map(({ hour, sales }) => (
                <div key={hour} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                  <span>R$ {sales.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Items más rentables */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Produtos Mais Rentáveis</p>
            <div className="space-y-2">
              {topProfitItems.slice(0, 3).map(({ name, profit }) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {name}
                  </span>
                  <span>R$ {profit.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
