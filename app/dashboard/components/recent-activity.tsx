import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Users, CheckCircle2, Clock } from "lucide-react"

interface ActivityItem {
  id: string
  type: 'order' | 'table' | 'payment'
  description: string
  time: Date
  status?: string
  amount?: number
  tableNumber?: number
  paymentMethod?: string
}

interface RecentActivityProps {
  activities: ActivityItem[]
}

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'payment':
      return <CreditCard className="h-4 w-4" />
    case 'table':
      return <Users className="h-4 w-4" />
    case 'order':
      return <CheckCircle2 className="h-4 w-4" />
  }
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade Recente</CardTitle>
        <CardDescription>Últimas ações no estabelecimento</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-4 border-b pb-4 last:border-0">
              <div className="mt-1">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {activity.description}
                </p>
                {activity.status && (
                  <p className="text-sm text-muted-foreground">
                    Status: {activity.status}
                  </p>
                )}
                {activity.paymentMethod && (
                  <p className="text-sm text-muted-foreground">
                    Pagamento: {activity.paymentMethod}
                  </p>
                )}
                {activity.amount && activity.amount > 0 && (
                  <p className="text-sm font-medium">
                    R$ {activity.amount.toFixed(2)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {activity.time.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {activity.tableNumber && ` • Mesa ${activity.tableNumber}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}