import { format } from "date-fns";
import { es } from "date-fns/locale";

type CatalogProduct = {
  name?: string;
  flavor?: string | null;
  description?: string;
  clientPrice?: number;
  image?: { url?: string } | string | null;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo convertir imagen a DataURL"));
      }
    };
    reader.onerror = () => reject(new Error("Error leyendo imagen"));
    reader.readAsDataURL(blob);
  });

const compressDataUrlImage = (
  dataUrl: string,
  options: { maxDimension: number; quality: number }
) =>
  new Promise<string>(resolve => {
    const image = new Image();
    image.onload = () => {
      const { width, height } = image;
      const maxDimension = Math.max(options.maxDimension, 64);

      const ratio = Math.min(1, maxDimension / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * ratio));
      const targetHeight = Math.max(1, Math.round(height * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }

      // Convertimos a JPEG comprimido para reducir peso final del PDF.
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", options.quality));
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });

const loadImageAsDataUrl = async (
  url?: string | null,
  options: { maxDimension?: number; quality?: number } = {}
) => {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return await compressDataUrlImage(dataUrl, {
      maxDimension: options.maxDimension ?? 280,
      quality: options.quality ?? 0.72,
    });
  } catch {
    return null;
  }
};

const extractImageUrl = (product: CatalogProduct) => {
  if (!product.image) return null;
  if (typeof product.image === "string") return product.image;
  return product.image.url || null;
};

const normalizeImageFormat = (dataUrl: string) => {
  if (/^data:image\/jpe?g/i.test(dataUrl)) {
    return "JPEG";
  }
  return "PNG";
};

const getDisplayNameWithFlavor = (name?: string, flavor?: string | null) => {
  const cleanName = (name || "Sin nombre").trim();
  const cleanFlavor = flavor?.trim();
  if (!cleanFlavor) return cleanName;
  return `${cleanName} - Sabor ${cleanFlavor}`;
};

const truncateText = (value: string, limit: number) => {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Sin descripcion";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(limit - 1, 1)).trim()}...`;
};

export const exportToPDF = async (
  _data: any,
  title: string,
  columns: string[],
  rows: any[][]
) => {
  // Dynamic imports to reduce initial bundle size
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

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

export const exportToExcel = async (data: any[], filename: string) => {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");

  // Column widths
  const maxWidths = Object.keys(data[0] || {}).map(key => {
    const maxLength = Math.max(
      key.length,
      ...data.map(row => String(row[key] || "").length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  worksheet["!cols"] = maxWidths;

  XLSX.writeFile(
    workbook,
    `${filename.replace(/\s+/g, "_")}_${Date.now()}.xlsx`
  );
};

export const exportCatalogToPDF = async (
  products: CatalogProduct[],
  options: {
    businessName?: string;
    logoUrl?: string | null;
    title?: string;
  }
) => {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const businessName = options.businessName?.trim() || "Catalogo";
  const title = options.title || "Catalogo de Productos";

  const [logoDataUrl, productImages] = await Promise.all([
    loadImageAsDataUrl(options.logoUrl || null, {
      maxDimension: 220,
      quality: 0.78,
    }),
    Promise.all(
      (products || []).map(product =>
        loadImageAsDataUrl(extractImageUrl(product), {
          maxDimension: 200,
          quality: 0.62,
        }).then(imageData => {
          const rawFlavor =
            product.flavor ||
            ((product as any)?.sabor as string | undefined) ||
            ((product as any)?.variant as string | undefined) ||
            null;

          return {
            imageData,
            name: getDisplayNameWithFlavor(product.name, rawFlavor),
            description: truncateText(product.description || "", 100),
            pvp: Number(product.clientPrice || 0),
          };
        })
      )
    ),
  ]);

  const pageWidth = doc.internal.pageSize.getWidth();

  if (logoDataUrl) {
    const logoFormat = normalizeImageFormat(logoDataUrl);
    doc.addImage(logoDataUrl, logoFormat as any, 14, 10, 20, 20);
  }

  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(title, logoDataUrl ? 38 : 14, 18);

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(businessName, logoDataUrl ? 38 : 14, 25);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Generado: ${format(new Date(), "dd 'de' MMMM 'de' yyyy - HH:mm", {
      locale: es,
    })}`,
    14,
    34
  );

  const rows = productImages.map(product => [
    "",
    product.name,
    product.description,
    `$${product.pvp.toLocaleString("es-CO")}`,
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Imagen", "Producto", "Descripcion", "PVP"]],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontSize: 10,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 24, minCellHeight: 18 },
      1: { cellWidth: 56 },
      2: { cellWidth: 72 },
      3: { cellWidth: 34, halign: "right" },
    },
    didDrawCell: data => {
      if (data.section !== "body" || data.column.index !== 0) return;

      const productImage = productImages[data.row.index]?.imageData;
      if (!productImage) {
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Sin imagen", data.cell.x + 3, data.cell.y + 10);
        return;
      }

      const imgFormat = normalizeImageFormat(productImage);
      const size = 14;
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;

      doc.addImage(productImage, imgFormat as any, x, y, size, size);
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Pagina ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 8,
      { align: "center" }
    );
  }

  const safeBusinessName = businessName
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  doc.save(`Catalogo_${safeBusinessName || "Empresa"}_${Date.now()}.pdf`);
};

export const exportKPIsToPDF = async (kpis: any) => {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;
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
      [
        "Ganancia neta",
        `$${(kpis.todayNetProfit ?? kpis.todayProfit).toFixed(2)}`,
      ],
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
      [
        "Ganancia neta",
        `$${(kpis.weekNetProfit ?? kpis.weekProfit).toFixed(2)}`,
      ],
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
      [
        "Ganancia neta",
        `$${(kpis.monthNetProfit ?? kpis.monthProfit).toFixed(2)}`,
      ],
      ["Ticket Promedio", `$${kpis.averageTicket.toFixed(2)}`],
      ["Distribuidores Activos", kpis.totalActiveDistributors.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246] },
  });

  doc.save(`KPIs_Financieros_${Date.now()}.pdf`);
};

export const exportRankingsToPDF = async (rankings: any[]) => {
  const rows = rankings.map(dist => [
    dist.rank.toString(),
    dist.name,
    dist.totalSales.toString(),
    `$${dist.revenue.toFixed(2)}`,
    `$${dist.profit.toFixed(2)}`,
    `${dist.conversionRate.toFixed(1)}%`,
    `$${dist.averageOrderValue.toFixed(2)}`,
  ]);

  await exportToPDF(
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

export const exportRankingsToExcel = async (rankings: any[]) => {
  const data = rankings.map(dist => ({
    Posición: dist.rank,
    Distribuidor: dist.name,
    Email: dist.email,
    "Total Ventas": dist.totalSales,
    Ingresos: dist.revenue,
    Ganancia: dist.profit,
    "Tasa de Conversión": `${dist.conversionRate.toFixed(1)}%`,
    "Ticket Promedio": dist.averageOrderValue,
  }));

  await exportToExcel(data, "Ranking_Distribuidores");
};
