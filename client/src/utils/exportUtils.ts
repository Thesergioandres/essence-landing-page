import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const exportToPDF = (
  _data: any,
  title: string,
  columns: string[],
  rows: any[][]
) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(139, 92, 246); // Purple
  doc.text(title, 14, 22);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Generado: ${format(new Date(), "dd 'de' MMMM 'de' yyyy - HH:mm", {
      locale: es,
    })}`,
    14,
    30
  );

  // Table
  autoTable(doc, {
    startY: 35,
    head: [columns],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: [139, 92, 246],
      textColor: 255,
      fontSize: 10,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 35 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }

  doc.save(`${title.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
};

export const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");

  // Column widths
  const maxWidths = Object.keys(data[0] || {}).map((key) => {
    const maxLength = Math.max(
      key.length,
      ...data.map((row) => String(row[key] || "").length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  worksheet["!cols"] = maxWidths;

  XLSX.writeFile(
    workbook,
    `${filename.replace(/\s+/g, "_")}_${Date.now()}.xlsx`
  );
};

export const exportKPIsToPDF = (kpis: any) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(24);
  doc.setTextColor(139, 92, 246);
  doc.text("Reporte de KPIs Financieros", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Generado: ${format(new Date(), "dd 'de' MMMM 'de' yyyy - HH:mm", {
      locale: es,
    })}`,
    14,
    28
  );

  // Today's metrics
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Métricas de Hoy", 14, 40);

  autoTable(doc, {
    startY: 45,
    head: [["Métrica", "Valor"]],
    body: [
      ["Ventas", kpis.todaySales.toString()],
      ["Ingresos", `$${kpis.todayRevenue.toFixed(2)}`],
      ["Ganancia", `$${kpis.todayProfit.toFixed(2)}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246] },
  });

  // Week's metrics
  doc.setFontSize(16);
  doc.text("Métricas de la Semana", 14, (doc as any).lastAutoTable.finalY + 15);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["Métrica", "Valor"]],
    body: [
      ["Ventas", kpis.weekSales.toString()],
      ["Ingresos", `$${kpis.weekRevenue.toFixed(2)}`],
      ["Ganancia", `$${kpis.weekProfit.toFixed(2)}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246] },
  });

  // Month's metrics
  doc.setFontSize(16);
  doc.text("Métricas del Mes", 14, (doc as any).lastAutoTable.finalY + 15);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 20,
    head: [["Métrica", "Valor"]],
    body: [
      ["Ventas", kpis.monthSales.toString()],
      ["Ingresos", `$${kpis.monthRevenue.toFixed(2)}`],
      ["Ganancia", `$${kpis.monthProfit.toFixed(2)}`],
      ["Ticket Promedio", `$${kpis.averageTicket.toFixed(2)}`],
      ["Distribuidores Activos", kpis.totalActiveDistributors.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246] },
  });

  doc.save(`KPIs_Financieros_${Date.now()}.pdf`);
};

export const exportRankingsToPDF = (rankings: any[]) => {
  const rows = rankings.map((dist) => [
    dist.rank.toString(),
    dist.name,
    dist.totalSales.toString(),
    `$${dist.revenue.toFixed(2)}`,
    `$${dist.profit.toFixed(2)}`,
    `${dist.conversionRate.toFixed(1)}%`,
    `$${dist.averageOrderValue.toFixed(2)}`,
  ]);

  exportToPDF(
    rankings,
    "Ranking de Distribuidores",
    [
      "Pos",
      "Distribuidor",
      "Ventas",
      "Ingresos",
      "Ganancia",
      "Conv. Rate",
      "Ticket Prom.",
    ],
    rows
  );
};

export const exportRankingsToExcel = (rankings: any[]) => {
  const data = rankings.map((dist) => ({
    Posición: dist.rank,
    Distribuidor: dist.name,
    Email: dist.email,
    "Total Ventas": dist.totalSales,
    Ingresos: dist.revenue,
    Ganancia: dist.profit,
    "Tasa de Conversión": `${dist.conversionRate.toFixed(1)}%`,
    "Ticket Promedio": dist.averageOrderValue,
  }));

  exportToExcel(data, "Ranking_Distribuidores");
};
