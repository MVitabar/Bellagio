"use client"

import { Button } from "@/components/ui/button"
import { FileSpreadsheet, FileText } from "lucide-react"
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ReportData {
  startDate?: Date;
  endDate?: Date;
  dailySales: number;
  orderCount: number;
  averageTicket: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  categoryData: { name: string; value: number; percentage: number }[];
  paymentMethods: { method: string; count: number; percentage: number }[];
  waiterStats: {
    waiter: string;
    totalSales: number;
    totalOrders: number;
    averageTicket: number;
    topCategories: { category: string; sales: number }[];
  }[];
}

interface ReportGeneratorsProps {
  reportData: ReportData;
}

export function ReportGenerators({ reportData }: ReportGeneratorsProps) {
  const getDateRange = () => {
    if (reportData.startDate && reportData.endDate) {
      if (format(reportData.startDate, 'dd/MM/yyyy') === format(reportData.endDate, 'dd/MM/yyyy')) {
        return format(reportData.startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }
      return `${format(reportData.startDate, "dd 'de' MMMM", { locale: ptBR })} até ${format(reportData.endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    }
    return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const generateExcel = () => {
    const workbook = XLSX.utils.book_new();
    const dateRange = getDateRange();

    // Estilo para el encabezado
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } } };

    // Resumen del día
    const summaryData = [
      [`Relatório de Vendas - ${dateRange}`],
      [],
      ['Métrica', 'Valor'],
      ['Vendas Totais', `R$ ${reportData.dailySales.toFixed(2)}`],
      ['Total de Pedidos', reportData.orderCount.toString()],
      ['Ticket Médio', `R$ ${reportData.averageTicket.toFixed(2)}`]
    ];
    const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWS, 'Resumo');

    // Items más vendidos
    const itemsData = [
      ['Item', 'Quantidade', 'Receita', '% do Total']
    ];
    reportData.topItems.forEach(item => {
      const percentage = (item.revenue / reportData.dailySales) * 100;
      itemsData.push([
        item.name,
        item.quantity.toString(),
        `R$ ${item.revenue.toFixed(2)}`,
        `${percentage.toFixed(1)}%`
      ]);
    });
    const itemsWS = XLSX.utils.aoa_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(workbook, itemsWS, 'Items');

    // Categorías
    const categoriesData = [
      ['Categoria', 'Valor', 'Porcentagem']
    ];
    reportData.categoryData.forEach(cat => {
      categoriesData.push([
        cat.name,
        `R$ ${cat.value.toFixed(2)}`,
        `${cat.percentage.toFixed(1)}%`
      ]);
    });
    const categoriesWS = XLSX.utils.aoa_to_sheet(categoriesData);
    XLSX.utils.book_append_sheet(workbook, categoriesWS, 'Categorias');

    // Métodos de pago
    const paymentsData = [
      ['Método', 'Quantidade', 'Porcentagem']
    ];
    reportData.paymentMethods.forEach(method => {
      paymentsData.push([
        method.method,
        method.count.toString(),
        `${method.percentage.toFixed(1)}%`
      ]);
    });
    const paymentsWS = XLSX.utils.aoa_to_sheet(paymentsData);
    XLSX.utils.book_append_sheet(workbook, paymentsWS, 'Pagamentos');

    // Estadísticas por mesero
    const waiterData = [
      ['Funcionário', 'Vendas', 'Pedidos', 'Ticket Médio', '% das Vendas']
    ];
    reportData.waiterStats.forEach(waiter => {
      const salesPercentage = (waiter.totalSales / reportData.dailySales) * 100;
      waiterData.push([
        waiter.waiter,
        `R$ ${waiter.totalSales.toFixed(2)}`,
        waiter.totalOrders.toString(),
        `R$ ${waiter.averageTicket.toFixed(2)}`,
        `${salesPercentage.toFixed(1)}%`
      ]);
    });
    const waiterWS = XLSX.utils.aoa_to_sheet(waiterData);
    XLSX.utils.book_append_sheet(workbook, waiterWS, 'Funcionários');

    // Generar y descargar el archivo
    const fileName = `relatorio_${format(reportData.startDate || new Date(), 'dd-MM-yyyy')}${
      reportData.endDate ? `_ate_${format(reportData.endDate, 'dd-MM-yyyy')}` : ''
    }.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const generatePDF = () => {
    // Create new jsPDF instance
    const doc = new jsPDF();
    // Add autoTable functionality
    autoTable(doc as any, {});
    
    const dateRange = getDateRange();

    // Título
    doc.setFontSize(20);
    doc.text('Relatório de Vendas', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(dateRange, 105, 22, { align: 'center' });

    // Resumen
    doc.setFontSize(16);
    doc.text('Resumo', 14, 35);
    doc.setFontSize(12);
    const summaryData = [
      ['Vendas Totais', `R$ ${reportData.dailySales.toFixed(2)}`],
      ['Total de Pedidos', reportData.orderCount.toString()],
      ['Ticket Médio', `R$ ${reportData.averageTicket.toFixed(2)}`]
    ];
    autoTable(doc, {
      startY: 40,
      head: [['Métrica', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Items más vendidos
    doc.setFontSize(16);
    doc.text('Top 10 Items Mais Vendidos', 14, doc.lastAutoTable.finalY + 15);
    const itemsData = reportData.topItems.map((item, index) => {
      const percentage = (item.revenue / reportData.dailySales) * 100;
      return [
        `${index + 1}. ${item.name}`,
        item.quantity.toString(),
        `R$ ${item.revenue.toFixed(2)}`,
        `${percentage.toFixed(1)}%`
      ];
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Item', 'Quantidade', 'Receita', '% das Vendas']],
      body: itemsData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' }
      }
    });

    // Nueva página para meseros
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Desempenho da Equipe', 14, 15);
    const waiterData = reportData.waiterStats.map(waiter => {
      const salesPercentage = (waiter.totalSales / reportData.dailySales) * 100;
      return [
        waiter.waiter,
        `R$ ${waiter.totalSales.toFixed(2)}`,
        waiter.totalOrders.toString(),
        `R$ ${waiter.averageTicket.toFixed(2)}`,
        `${salesPercentage.toFixed(1)}%`
      ];
    });
    autoTable(doc, {
      startY: 20,
      head: [['Funcionário', 'Vendas', 'Pedidos', 'Ticket Médio', '% das Vendas']],
      body: waiterData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Top categorías por mesero
    doc.setFontSize(14);
    doc.text('Top Categorias por Funcionário', 14, doc.lastAutoTable.finalY + 15);
    
    let yPos = doc.lastAutoTable.finalY + 20;
    reportData.waiterStats.forEach(waiter => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      const topCategories = waiter.topCategories
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      autoTable(doc, {
        startY: yPos,
        head: [[`${waiter.waiter} - Top 5 Categorias`]],
        body: topCategories.map(cat => [`${cat.category}: R$ ${cat.sales.toFixed(2)}`]),
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
    });

    // Generar y descargar el archivo
    const fileName = `relatorio_${format(reportData.startDate || new Date(), 'dd-MM-yyyy')}${
      reportData.endDate ? `_ate_${format(reportData.endDate, 'dd-MM-yyyy')}` : ''
    }.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={generateExcel}
        className="flex items-center gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={generatePDF}
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}
