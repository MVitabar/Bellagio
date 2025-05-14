"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import * as XLSX from 'xlsx'

interface ReportData {
  sales?: {
    date?: string;
    total?: number;
    orders?: number;
    weekSales?: { date: string; total: number }[];
    topItems?: { name: string; quantity: number; revenue: number }[];
    categoryData?: { name: string; value: number; percentage: number }[];
    peakHours?: { hour: number; sales: number }[];
    paymentMethods?: { method: string; count: number; percentage: number }[];
  }
}

interface ExcelReportGeneratorProps {
  reportData: ReportData;
}

export function ExcelReportGenerator({ reportData }: ExcelReportGeneratorProps) {
  const generateExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Ventas del día
    if (reportData.sales?.date) {
      const dailyData = [
        ['Data', 'Total', 'Pedidos'],
        [
          reportData.sales.date,
          reportData.sales.total?.toFixed(2) || '0.00',
          reportData.sales.orders || 0
        ]
      ];
      const dailyWS = XLSX.utils.aoa_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(workbook, dailyWS, 'Vendas do Dia');
    }

    // Ventas semanales
    if (reportData.sales?.weekSales?.length) {
      const weeklyData = [
        ['Data', 'Total']
      ];
      reportData.sales.weekSales.forEach(sale => {
        weeklyData.push([sale.date, sale.total.toFixed(2)]);
      });
      const weeklyWS = XLSX.utils.aoa_to_sheet(weeklyData);
      XLSX.utils.book_append_sheet(workbook, weeklyWS, 'Vendas Semanais');
    }

    // Items más vendidos
    if (reportData.sales?.topItems?.length) {
      const itemsData = [
        ['Item', 'Quantidade', 'Receita']
      ];
      reportData.sales.topItems.forEach(item => {
        itemsData.push([
          item.name,
          item.quantity.toString(),
          item.revenue.toFixed(2)
        ]);
      });
      const itemsWS = XLSX.utils.aoa_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(workbook, itemsWS, 'Itens Mais Vendidos');
    }

    // Ventas por categoría
    if (reportData.sales?.categoryData?.length) {
      const categoryData = [
        ['Categoria', 'Valor', 'Porcentagem']
      ];
      reportData.sales.categoryData.forEach(cat => {
        categoryData.push([
          cat.name,
          cat.value.toFixed(2),
          `${cat.percentage.toFixed(1)}%`
        ]);
      });
      const categoryWS = XLSX.utils.aoa_to_sheet(categoryData);
      XLSX.utils.book_append_sheet(workbook, categoryWS, 'Vendas por Categoria');
    }

    // Horas pico
    if (reportData.sales?.peakHours?.length) {
      const hoursData = [
        ['Hora', 'Vendas']
      ];
      reportData.sales.peakHours.forEach(hour => {
        hoursData.push([
          `${hour.hour}:00`,
          hour.sales.toFixed(2)
        ]);
      });
      const hoursWS = XLSX.utils.aoa_to_sheet(hoursData);
      XLSX.utils.book_append_sheet(workbook, hoursWS, 'Horas Pico');
    }

    // Métodos de pago
    if (reportData.sales?.paymentMethods?.length) {
      const methodsData = [
        ['Método', 'Quantidade', 'Porcentagem']
      ];
      reportData.sales.paymentMethods.forEach(method => {
        methodsData.push([
          method.method,
          method.count.toString(),
          `${method.percentage.toFixed(1)}%`
        ]);
      });
      const methodsWS = XLSX.utils.aoa_to_sheet(methodsData);
      XLSX.utils.book_append_sheet(workbook, methodsWS, 'Métodos de Pagamento');
    }

    // Generar y descargar el archivo
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `relatorio_${date}.xlsx`);
  }

  return (
    <Button 
      onClick={generateExcel} 
      className="w-full"
    >
      <Download className="w-4 h-4 mr-2" />
      Exportar para Excel
    </Button>
  )
}
