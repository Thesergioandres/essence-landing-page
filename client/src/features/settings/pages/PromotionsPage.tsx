import {
  BarChart3,
  Calendar,
  Edit,
  Gift,
  Image as ImageIcon,
  Loader2,
  Package,
  Pause,
  Percent,
  Play,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductSelector from "../../../components/ProductSelector";
import { branchService } from "../../branches/services";
import { promotionService } from "../../settings/services";
import { invalidateProductCache } from "../../../hooks/useProductCache";
import type {
  Branch,
  Product,
  Promotion,
  PromotionComboItem,
  PromotionMetrics,
  PromotionStats,
  PromotionStatus,
  PromotionType,
} from "../../../types";

const typeConfig: Record<
  PromotionType,
  { label: string; icon: React.ReactNode; color: string; description: string }
> = {
  bundle: {
    label: "Bundle",
    icon: <Package className="h-4 w-4" />,
    color: "bg-purple-900/30 text-purple-400 border-purple-700/50",
    description: "Paquete de productos a precio especial",
  },
  combo: {
    label: "Combo",
    icon: <ShoppingCart className="h-4 w-4" />,
    color: "bg-blue-900/30 text-blue-400 border-blue-700/50",
    description: "Combinación de productos con descuento",
  },
  bogo: {
    label: "2x1",
    icon: <Gift className="h-4 w-4" />,
    color: "bg-pink-900/30 text-pink-400 border-pink-700/50",
    description: "Compra uno y lleva otro gratis",
  },
  discount: {
    label: "Descuento",
    icon: <Percent className="h-4 w-4" />,
    color: "bg-green-900/30 text-green-400 border-green-700/50",
    description: "Descuento porcentual o fijo",
  },
  volume: {
    label: "Por Volumen",
    icon: <Tag className="h-4 w-4" />,
    color: "bg-orange-900/30 text-orange-400 border-orange-700/50",
    description: "Descuento por comprar más cantidad",
  },
};

const statusConfig: Record<
  PromotionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: "Activa",
    color: "bg-green-900/30 text-green-400 border-green-700/50",
    icon: <Play className="h-3 w-3" />,
  },
  paused: {
    label: "Pausada",
    color: "bg-yellow-900/30 text-yellow-400 border-yellow-700/50",
    icon: <Pause className="h-3 w-3" />,
  },
  draft: {
    label: "Borrador",
    color: "bg-gray-700/30 text-gray-400 border-gray-600/50",
    icon: <Edit className="h-3 w-3" />,
  },
  archived: {
    label: "Archivada",
    color: "bg-red-900/30 text-red-400 border-red-700/50",
    icon: <Trash2 className="h-3 w-3" />,
  },
};

// Tipo de producto que viene del ProductSelector
interface ProductSelectorProduct {
  _id: string;
  name: string;
  category?: { _id: string; name: string } | string;
  totalStock?: number;
  purchasePrice?: number;
  suggestedPrice?: number;
  clientPrice?: number;
  distributorPrice?: number;
  image?: { url: string };
}

interface ComboItemForm {
  product: string;
  productName: string;
  productImage?: string;
  productPrice: number;
  purchasePrice: number;
  distributorPrice: number;
  quantity: number;
  unitPrice: number;
}

export default function Promotions() {
  // Módulo activo
  // const isUnderDevelopment = false;

  // (Removed development warning block)

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [stats, setStats] = useState<PromotionStats | null>(null);
  const [metrics, setMetrics] = useState<PromotionMetrics | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "bundle" as PromotionType,
    status: "active" as PromotionStatus,
    promotionPrice: 0,
    distributorPrice: 0,
    startDate: "",
    endDate: "",
    branches: [] as string[],
    showInCatalog: true,
    displayOrder: 0,
    usageLimit: "",
    usageLimitPerCustomer: "",
    totalStock: "",
  });

  // Combo items state
  const [comboItems, setComboItems] = useState<ComboItemForm[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [generatingCollage, setGeneratingCollage] = useState(false);
  const manualImageRef = useRef(false); // Track if user manually uploaded an image

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [promoRes, branchList] = await Promise.all([
        promotionService.getAll({
          status: filterStatus !== "all" ? filterStatus : undefined,
        }),
        branchService.list(),
      ]);
      setPromotions(promoRes.promotions || []);
      setStats(promoRes.stats || null);
      setBranches(branchList || []);
    } catch (err) {
      console.error("Error loading promotions:", err);
      setError("Error al cargar promociones");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const loadMetrics = async () => {
    try {
      const data = await promotionService.getMetrics();
      setMetrics(data);
      setShowMetrics(true);
    } catch (err) {
      console.error("Error loading metrics:", err);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("La imagen no puede superar 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImageBase64(base64);
        setImagePreview(base64);
        manualImageRef.current = true; // Mark as manually uploaded
      };
      reader.readAsDataURL(file);
    }
  };

  // 🎨 Canvas-based Product Collage Generator
  const generateProductCollage = useCallback(
    async (imageUrls: string[]): Promise<string | null> => {
      if (imageUrls.length === 0) return null;

      const CANVAS_SIZE = 600;
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      gradient.addColorStop(0, "#1a1a2e");
      gradient.addColorStop(1, "#16213e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Load images with error handling
      const loadImage = (url: string): Promise<HTMLImageElement | null> => {
        return new Promise(resolve => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });
      };

      const images = (await Promise.all(imageUrls.map(loadImage))).filter(
        (img): img is HTMLImageElement => img !== null
      );

      if (images.length === 0) return null;

      // Calculate grid layout
      const count = images.length;
      const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
      const rows = Math.ceil(count / cols);
      const cellWidth = CANVAS_SIZE / cols;
      const cellHeight = CANVAS_SIZE / rows;
      const padding = 8;

      // Draw images with "contain" fit
      images.forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellWidth + padding;
        const y = row * cellHeight + padding;
        const maxW = cellWidth - padding * 2;
        const maxH = cellHeight - padding * 2;

        // Calculate scale to fit (contain)
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = x + (maxW - drawW) / 2;
        const drawY = y + (maxH - drawH) / 2;

        // Draw rounded rect background
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.roundRect(x, y, maxW, maxH, 12);
        ctx.fill();

        // Clip and draw image
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, drawW, drawH, 8);
        ctx.clip();
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
      });

      // Add combo badge
      ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
      ctx.beginPath();
      ctx.roundRect(CANVAS_SIZE - 120, 12, 108, 32, 16);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${count} productos`, CANVAS_SIZE - 66, 34);

      return canvas.toDataURL("image/jpeg", 0.85);
    },
    []
  );

  // 🔄 Auto-generate collage when comboItems change
  // 🔄 Auto-generate collage when comboItems change
  useEffect(() => {
    const generateCollage = async () => {
      // Only auto-generate for bundle/combo types
      if (formData.type !== "bundle" && formData.type !== "combo") return;

      // Skip if user manually uploaded an image
      if (manualImageRef.current) return;

      // Get image URLs from combo items
      const imageUrls = comboItems
        .map(item => item.productImage)
        .filter((url): url is string => !!url);

      if (imageUrls.length === 0) {
        // Clear auto-generated image if no products
        if (!manualImageRef.current) {
          setImagePreview(null);
          setImageBase64(null);
        }
        return;
      }

      setGeneratingCollage(true);
      try {
        const collageBase64 = await generateProductCollage(imageUrls);
        if (collageBase64 && !manualImageRef.current) {
          setImagePreview(collageBase64);
          setImageBase64(collageBase64);
        }
      } catch (err) {
        console.error("Error generating collage:", err);
      } finally {
        setGeneratingCollage(false);
      }
    };

    void generateCollage();
  }, [comboItems, formData.type, generateProductCollage]);

  const handleProductSelect = useCallback(
    (productId: string, product?: ProductSelectorProduct) => {
      if (!product) return;
      if (comboItems.some(item => item.product === productId)) {
        setError("Este producto ya está en la promoción");
        return;
      }
      const price = product.clientPrice ?? product.suggestedPrice ?? 0;
      const cost = product.purchasePrice ?? 0;
      const distPrice = product.distributorPrice ?? price;

      setComboItems(prev => [
        ...prev,
        {
          product: productId,
          productName: product.name,
          productImage: product.image?.url,
          productPrice: price,
          purchasePrice: cost,
          distributorPrice: distPrice,
          quantity: 1,
          unitPrice: price,
        },
      ]);
    },
    [comboItems]
  );

  const removeComboItem = (productId: string) => {
    setComboItems(prev => prev.filter(item => item.product !== productId));
  };

  const updateComboItem = (
    productId: string,
    field: "quantity" | "unitPrice",
    value: number
  ) => {
    setComboItems(prev =>
      prev.map(item =>
        item.product === productId ? { ...item, [field]: value } : item
      )
    );
  };

  const calculateOriginalPrice = () =>
    comboItems.reduce(
      (sum, item) => sum + item.productPrice * item.quantity,
      0
    );

  const calculateSavings = () => {
    const original = calculateOriginalPrice();
    const promo = formData.promotionPrice || 0;
    return Math.max(0, original - promo);
  };

  const calculateSavingsPercentage = () => {
    const original = calculateOriginalPrice();
    if (original === 0) return 0;
    return Math.round((calculateSavings() / original) * 100);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "bundle",
      status: "active",
      promotionPrice: 0,
      distributorPrice: 0,
      startDate: "",
      endDate: "",
      branches: [],
      showInCatalog: true,
      displayOrder: 0,
      usageLimit: "",
      usageLimitPerCustomer: "",
      totalStock: "",
    });
    setComboItems([]);
    setImagePreview(null);
    setImageBase64(null);
    setEditingPromo(null);
    manualImageRef.current = false; // Reset manual upload flag
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (promo: Promotion) => {
    console.log(
      "Opening edit modal for:",
      promo.name,
      "DistPrice:",
      promo.distributorPrice
    );
    setEditingPromo(promo);
    setFormData({
      name: promo.name,
      description: promo.description || "",
      type: promo.type,
      status: promo.status,
      promotionPrice: promo.promotionPrice || 0,
      distributorPrice: promo.distributorPrice || 0,
      startDate: promo.startDate ? promo.startDate.split("T")[0] : "",
      endDate: promo.endDate ? promo.endDate.split("T")[0] : "",
      branches: (promo.branches || []).map(b =>
        typeof b === "string" ? b : b._id
      ),
      showInCatalog: promo.showInCatalog !== false,
      displayOrder: promo.displayOrder || 0,
      usageLimit: promo.usageLimit?.toString() || "",
      usageLimitPerCustomer: promo.usageLimitPerCustomer?.toString() || "",
      totalStock: promo.totalStock?.toString() || "",
    });
    setComboItems(
      (promo.comboItems || []).map((item: PromotionComboItem) => {
        const product = typeof item.product === "object" ? item.product : null;
        return {
          product: product?._id || (item.product as string),
          productName: product?.name || "Producto",
          productImage: product?.image?.url,
          productPrice: product?.clientPrice || product?.suggestedPrice || 0,
          purchasePrice: product?.purchasePrice || 0,
          distributorPrice:
            product?.distributorPrice || product?.clientPrice || 0,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
        };
      })
    );
    setImagePreview(promo.image?.url || null);
    setImageBase64(null);
    manualImageRef.current = !!promo.image?.url; // Preserve existing image
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validaciones
      if (!formData.name.trim()) {
        throw new Error("El nombre es obligatorio");
      }
      if (
        (formData.type === "bundle" || formData.type === "combo") &&
        comboItems.length === 0
      ) {
        throw new Error("Debes agregar al menos un producto al bundle/combo");
      }

      const payload: Partial<Promotion> = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        status: formData.status,
        promotionPrice: formData.promotionPrice,
        distributorPrice: formData.distributorPrice,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        branches:
          formData.branches.length > 0
            ? (formData.branches as unknown as Branch[])
            : undefined,
        showInCatalog: formData.showInCatalog,
        displayOrder: formData.displayOrder,
        usageLimit: formData.usageLimit
          ? parseInt(formData.usageLimit)
          : undefined,
        usageLimitPerCustomer: formData.usageLimitPerCustomer
          ? parseInt(formData.usageLimitPerCustomer)
          : undefined,
        totalStock: formData.totalStock
          ? parseInt(formData.totalStock)
          : undefined,
        comboItems: comboItems.map(item => ({
          product: item.product as unknown as Product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      if (imageBase64) {
        payload.image = { url: imageBase64 } as Promotion["image"];
      }

      if (editingPromo) {
        await promotionService.update(editingPromo._id, payload);
        setSuccess("Promoción actualizada correctamente");
      } else {
        await promotionService.create(payload);
        setSuccess("Promoción creada correctamente");
      }

      // Invalidate product cache to reflect changes in ProductSelector/Catalog
      invalidateProductCache();

      setShowModal(false);
      resetForm();
      void loadData();
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Error al guardar promoción");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (promo: Promotion) => {
    try {
      const { promotion } = await promotionService.toggleStatus(promo._id);
      setPromotions(prev =>
        prev.map(p => (p._id === promo._id ? promotion : p))
      );
      setSuccess(
        `Promoción ${promotion.status === "active" ? "activada" : "pausada"}`
      );
    } catch (err) {
      console.error("Error toggling status:", err);
      setError("Error al cambiar estado");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de archivar esta promoción?")) return;
    try {
      await promotionService.delete(id);

      // Invalidate product cache
      invalidateProductCache();

      setPromotions(prev => prev.filter(p => p._id !== id));
      setSuccess("Promoción archivada");
      void loadData();
    } catch (err) {
      console.error("Error deleting:", err);
      setError("Error al archivar promoción");
    }
  };

  // Filtrar promociones
  const filteredPromotions = promotions.filter(promo => {
    const matchesSearch =
      promo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      promo.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || promo.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/50 p-4 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="float-right">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-700 bg-green-900/50 p-4 text-green-400">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Promociones</h1>
          <p className="text-gray-400">
            Gestiona tus ofertas, bundles y combos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadMetrics}
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-gray-300 transition hover:bg-gray-800"
          >
            <BarChart3 className="h-4 w-4" />
            Métricas
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Nueva Promoción
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-sm text-gray-400">Total</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-green-700/50 bg-green-900/20 p-4">
            <p className="text-sm text-green-400">Activas</p>
            <p className="mt-1 text-2xl font-bold text-green-400">
              {stats.active}
            </p>
          </div>
          <div className="rounded-xl border border-yellow-700/50 bg-yellow-900/20 p-4">
            <p className="text-sm text-yellow-400">Pausadas</p>
            <p className="mt-1 text-2xl font-bold text-yellow-400">
              {stats.paused}
            </p>
          </div>
          <div className="rounded-xl border border-purple-700/50 bg-purple-900/20 p-4">
            <p className="text-sm text-purple-400">Ingresos</p>
            <p className="mt-1 text-xl font-bold text-purple-400">
              {formatCurrency(stats.totalRevenue)}
            </p>
          </div>
          <div className="rounded-xl border border-blue-700/50 bg-blue-900/20 p-4">
            <p className="text-sm text-blue-400">Vendidas</p>
            <p className="mt-1 text-2xl font-bold text-blue-400">
              {stats.totalUnitsSold}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar promoción..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(typeConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="paused">Pausadas</option>
          <option value="draft">Borradores</option>
          <option value="archived">Archivadas</option>
        </select>
      </div>

      {/* Promotions Grid */}
      {filteredPromotions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-600 p-12 text-center">
          <Gift className="mx-auto h-16 w-16 text-gray-600" />
          <p className="mt-4 text-lg text-gray-400">No hay promociones</p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Crear tu primera promoción
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPromotions.map(promo => {
            const typeInfo = typeConfig[promo.type] || typeConfig.discount;
            const statusInfo = statusConfig[promo.status] || statusConfig.draft;
            const savings =
              promo.originalPrice && promo.promotionPrice
                ? promo.originalPrice - promo.promotionPrice
                : 0;
            const savingsPercent =
              promo.originalPrice && savings > 0
                ? Math.round((savings / promo.originalPrice) * 100)
                : 0;

            return (
              <div
                key={promo._id}
                className="group overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 transition hover:border-purple-600/50"
              >
                {/* Image */}
                <div className="relative h-40 bg-gray-900">
                  {promo.image?.url ? (
                    <img
                      src={promo.image.url}
                      alt={promo.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-16 w-16 text-gray-700" />
                    </div>
                  )}
                  {/* Badges */}
                  <div className="absolute left-2 top-2 flex gap-2">
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${typeInfo.color}`}
                    >
                      {typeInfo.icon}
                      {typeInfo.label}
                    </span>
                  </div>
                  <div className="absolute right-2 top-2">
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>
                  {savingsPercent > 0 && (
                    <div className="absolute bottom-2 right-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
                      -{savingsPercent}%
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white">
                    {promo.name}
                  </h3>
                  {promo.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                      {promo.description}
                    </p>
                  )}

                  {/* Products included */}
                  {promo.comboItems && promo.comboItems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {promo.comboItems.slice(0, 3).map((item, idx) => {
                        const product =
                          typeof item.product === "object"
                            ? item.product
                            : null;
                        return (
                          <span
                            key={idx}
                            className="rounded-full bg-gray-700/50 px-2 py-0.5 text-xs text-gray-300"
                          >
                            {item.quantity}x {product?.name || "Producto"}
                          </span>
                        );
                      })}
                      {promo.comboItems.length > 3 && (
                        <span className="rounded-full bg-gray-700/50 px-2 py-0.5 text-xs text-gray-400">
                          +{promo.comboItems.length - 3} más
                        </span>
                      )}
                    </div>
                  )}

                  {/* Prices */}
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-purple-400">
                      {formatCurrency(promo.promotionPrice || 0)}
                    </span>
                    {promo.originalPrice &&
                      promo.originalPrice > (promo.promotionPrice || 0) && (
                        <span className="text-sm text-gray-500 line-through">
                          {formatCurrency(promo.originalPrice)}
                        </span>
                      )}
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    {promo.usageCount !== undefined && promo.usageCount > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {promo.usageCount} vendidas
                      </span>
                    )}
                    {promo.endDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Hasta {formatDate(promo.endDate)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEditModal(promo)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 transition hover:bg-gray-700"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleStatus(promo)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-sm transition ${
                        promo.status === "active"
                          ? "border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/30"
                          : "border border-green-700/50 text-green-400 hover:bg-green-900/30"
                      }`}
                    >
                      {promo.status === "active" ? (
                        <>
                          <Pause className="h-4 w-4" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Activar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(promo._id)}
                      className="rounded-lg border border-red-700/50 p-2 text-red-400 transition hover:bg-red-900/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10">
          <div className="w-full max-w-7xl rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-700 p-4">
              <h2 className="text-xl font-semibold text-white">
                {editingPromo ? "Editar Promoción" : "Nueva Promoción"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="max-h-[70vh] overflow-y-auto p-4"
            >
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-300">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                      placeholder="Ej: Combo Verano"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-300">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                      placeholder="Descripción de la promoción..."
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-300">
                      Tipo *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        Object.entries(typeConfig) as [
                          PromotionType,
                          typeof typeConfig.bundle,
                        ][]
                      ).map(([key, config]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, type: key })
                          }
                          className={`flex items-center gap-2 rounded-lg border p-3 text-left transition ${
                            formData.type === key
                              ? "border-purple-500 bg-purple-900/30"
                              : "border-gray-700 hover:border-gray-600"
                          }`}
                        >
                          <span className={`rounded-lg p-2 ${config.color}`}>
                            {config.icon}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {config.label}
                            </p>
                            <p className="text-xs text-gray-500">
                              {config.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-300">
                      Imagen
                      {generatingCollage && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-purple-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generando collage...
                        </span>
                      )}
                    </label>
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-32 w-full rounded-lg object-cover"
                        />
                        {generatingCollage && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                            setImageBase64(null);
                            manualImageRef.current = true; // Prevent auto-generation unless user resets
                          }}
                          className="absolute right-2 top-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="relative flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-600 p-6 transition hover:border-purple-500">
                        {generatingCollage && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-800">
                            <div className="text-center">
                              <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-400" />
                              <p className="mt-2 text-xs text-gray-400">
                                Generando collage...
                              </p>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <div className="text-center">
                          <ImageIcon className="mx-auto h-8 w-8 text-gray-400" />
                          <p className="mt-1 text-sm text-gray-400">
                            Subir imagen
                          </p>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">
                        Fecha inicio
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            startDate: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">
                        Fecha fin
                      </label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={e =>
                          setFormData({ ...formData, endDate: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Branches */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-300">
                      Sucursales (opcional)
                    </label>
                    <select
                      multiple
                      value={formData.branches}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          branches: Array.from(
                            e.target.selectedOptions,
                            opt => opt.value
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    >
                      {branches.map(b => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Deja vacío para aplicar en todas las sucursales
                    </p>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">
                        Límite total
                      </label>
                      <input
                        type="number"
                        value={formData.usageLimit}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            usageLimit: e.target.value,
                          })
                        }
                        placeholder="Sin límite"
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">
                        Límite por cliente
                      </label>
                      <input
                        type="number"
                        value={formData.usageLimitPerCustomer}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            usageLimitPerCustomer: e.target.value,
                          })
                        }
                        placeholder="Sin límite"
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showInCatalog"
                      checked={formData.showInCatalog}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          showInCatalog: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                    />
                    <label
                      htmlFor="showInCatalog"
                      className="text-sm text-gray-300"
                    >
                      Mostrar en catálogo público
                    </label>
                  </div>
                </div>

                {/* Right Column - Products */}
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-300">
                      Productos incluidos *
                    </label>
                    <ProductSelector
                      value=""
                      onChange={
                        handleProductSelect as (
                          productId: string,
                          product?: unknown
                        ) => void
                      }
                      placeholder="Buscar producto para agregar..."
                      showStock={true}
                      excludeProductIds={comboItems.map(item => item.product)}
                      excludePromotions={true}
                    />
                  </div>

                  {/* Combo Items List */}
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-700 p-2">
                    {comboItems.length === 0 ? (
                      <p className="py-8 text-center text-gray-500">
                        Agrega productos a la promoción
                      </p>
                    ) : (
                      comboItems.map(item => (
                        <div
                          key={item.product}
                          className="flex items-center gap-3 rounded-lg bg-gray-800 p-3"
                        >
                          {item.productImage ? (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-700">
                              <Package className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">
                              {item.productName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Precio normal: {formatCurrency(item.productPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e =>
                                updateComboItem(
                                  item.product,
                                  "quantity",
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-16 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-center text-white"
                            />
                            <span className="text-xs text-gray-500">uds</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeComboItem(item.product)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Price Summary & Financial Breakdown */}
                  {comboItems.length > 0 && (
                    <div className="space-y-4">
                      {/* Original Price & Promo Price */}
                      <div className="rounded-lg border border-purple-700/50 bg-purple-900/20 p-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">
                            Precio original:
                          </span>
                          <span className="font-medium text-gray-300">
                            {formatCurrency(calculateOriginalPrice())}
                          </span>
                        </div>
                        <div className="mt-3">
                          <label className="mb-1 block text-sm font-medium text-purple-300">
                            Precio de la promoción *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={
                              formData.promotionPrice === 0
                                ? ""
                                : formData.promotionPrice
                            }
                            onChange={e =>
                              setFormData({
                                ...formData,
                                promotionPrice: parseFloat(e.target.value) || 0,
                              })
                            }
                            onBlur={e => {
                              if (e.target.value === "") {
                                setFormData({ ...formData, promotionPrice: 0 });
                              }
                            }}
                            className="w-full rounded-lg border border-purple-700/50 bg-purple-900/30 px-4 py-2 text-xl font-bold text-purple-300 focus:border-purple-500 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      {/* 📊 INGENERÍA DE PRECIOS - Responsive Grid */}
                      {formData.promotionPrice > 0 &&
                        (() => {
                          // Calculate financial metrics
                          const totalCost = comboItems.reduce(
                            (sum, item) =>
                              sum + (item.purchasePrice || 0) * item.quantity,
                            0
                          );
                          const totalPublicNormal = calculateOriginalPrice();
                          const adminProfit =
                            formData.promotionPrice - totalCost;
                          // CHANGE: Markup (ROI) = (Profit / Cost) * 100
                          const adminMargin =
                            totalCost > 0
                              ? Math.round((adminProfit / totalCost) * 100)
                              : 0;
                          const distributorProfit =
                            formData.promotionPrice - formData.distributorPrice;
                          const customerSavings =
                            totalPublicNormal - formData.promotionPrice;
                          const adminProfitB2B =
                            formData.distributorPrice - totalCost;
                          // CHANGE: Markup (ROI) = (Profit / Cost) * 100
                          const adminMarginB2B =
                            totalCost > 0
                              ? Math.round((adminProfitB2B / totalCost) * 100)
                              : 0;

                          const belowCostAlert =
                            formData.distributorPrice > 0 &&
                            formData.distributorPrice < totalCost;

                          return (
                            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 sm:p-4">
                              <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-300 sm:text-sm">
                                📊 Ingeniería de Precios
                              </h4>

                              {/* Alert if distributor price below cost */}
                              {belowCostAlert && (
                                <div className="mb-3 rounded-lg border border-red-500/50 bg-red-900/30 p-2 text-xs text-red-400 sm:text-sm">
                                  ⚠️ Precio distribuidor por debajo del costo
                                </div>
                              )}

                              {/* Responsive Grid: 1 col mobile, 2 col tablet, 3 col desktop */}
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Column 1: Admin Costs */}
                                <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-purple-400 sm:text-xs">
                                    💼 Mi Estructura
                                  </p>
                                  <div className="space-y-3">
                                    <div>
                                      <span className="block text-[10px] uppercase text-gray-500">
                                        Costo
                                      </span>
                                      <span className="block truncate text-lg font-semibold text-gray-300">
                                        {formatCurrency(totalCost)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase text-gray-500">
                                        Ganancia
                                      </span>
                                      <span
                                        className={`block truncate text-lg font-bold ${adminProfit >= 0 ? "text-green-400" : "text-red-400"}`}
                                      >
                                        {formatCurrency(adminProfit)}
                                        <span className="ml-1 text-xs font-normal opacity-75">
                                          ({adminMargin}% ROI)
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Column 2: Distributor (B2B) */}
                                <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-blue-400 sm:text-xs">
                                    🏷️ Distribuidor
                                  </p>
                                  <div className="space-y-3">
                                    <div>
                                      <span className="mb-1 block text-[10px] uppercase text-gray-500">
                                        Precio B2B
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={formData.distributorPrice || ""}
                                        onChange={e =>
                                          setFormData({
                                            ...formData,
                                            distributorPrice:
                                              parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-base font-semibold text-white focus:border-purple-500 focus:outline-none"
                                        placeholder="$0"
                                      />
                                      <div className="mt-1 text-right">
                                        <span className="text-[10px] text-gray-400">
                                          Precio actual que te paga el
                                          distribuidor:{" "}
                                          {formatCurrency(
                                            comboItems.reduce(
                                              (sum, item) =>
                                                sum +
                                                (item.distributorPrice || 0) *
                                                  item.quantity,
                                              0
                                            )
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    {formData.distributorPrice > 0 && (
                                      <div>
                                        <span className="block text-[10px] uppercase text-gray-500">
                                          Ganancia Dist.
                                        </span>
                                        <span
                                          className={`block truncate text-lg font-semibold ${distributorProfit >= 0 ? "text-blue-400" : "text-red-400"}`}
                                        >
                                          {formatCurrency(distributorProfit)}
                                          {formData.distributorPrice > 0 && (
                                            <span className="ml-1 text-xs font-normal opacity-75">
                                              (
                                              {Math.round(
                                                (distributorProfit /
                                                  formData.distributorPrice) *
                                                  100
                                              )}
                                              % ROI)
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {formData.distributorPrice > 0 && (
                                      <>
                                        <div className="my-1 border-t border-gray-700"></div>
                                        <div>
                                          <span className="block text-[10px] uppercase text-gray-500">
                                            Mi Ganancia B2B
                                          </span>
                                          <span
                                            className={`block truncate text-lg font-semibold ${
                                              adminProfitB2B <= 0
                                                ? "text-red-500"
                                                : adminMarginB2B < 10
                                                  ? "text-yellow-500"
                                                  : "text-green-500"
                                            }`}
                                          >
                                            {formatCurrency(adminProfitB2B)}{" "}
                                            <span className="text-xs">
                                              ({adminMarginB2B}% ROI)
                                            </span>
                                          </span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Column 3: Customer Savings */}
                                <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/50 p-3 sm:col-span-2 lg:col-span-1">
                                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-green-400 sm:text-xs">
                                    🎁 Cliente Final
                                  </p>
                                  <div className="space-y-3">
                                    <div>
                                      <span className="block text-[10px] uppercase text-gray-500">
                                        Precio Normal
                                      </span>
                                      <span className="block truncate text-lg font-semibold text-gray-400 line-through">
                                        {formatCurrency(totalPublicNormal)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase text-gray-500">
                                        Ahorra
                                      </span>
                                      <span
                                        className={`block truncate text-lg font-bold ${customerSavings > 0 ? "text-green-400" : "text-yellow-400"}`}
                                      >
                                        {formatCurrency(customerSavings)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                      {/* Old savings display - kept for backwards compatibility */}
                      {calculateSavings() > 0 && (
                        <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-900/30 p-2">
                          <span className="text-sm text-green-400">
                            💰 Ahorro para el cliente:
                          </span>
                          <span className="font-bold text-green-400">
                            {formatCurrency(calculateSavings())} (
                            {calculateSavingsPercentage()}%)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preview Card */}
                  {formData.name && comboItems.length > 0 && (
                    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                      <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                        Vista previa
                      </p>
                      <div className="flex gap-3">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-700">
                            <Package className="h-8 w-8 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white">
                            {formData.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {comboItems.length} producto
                            {comboItems.length > 1 ? "s" : ""} incluido
                            {comboItems.length > 1 ? "s" : ""}
                          </p>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-lg font-bold text-purple-400">
                              {formatCurrency(formData.promotionPrice)}
                            </span>
                            {calculateSavingsPercentage() > 0 && (
                              <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                                -{calculateSavingsPercentage()}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-700 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300 transition hover:bg-gray-800"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingPromo ? "Guardar cambios" : "Crear promoción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Metrics Modal */}
      {showMetrics && metrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                📊 Métricas de Promociones
              </h2>
              <button
                onClick={() => setShowMetrics(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Overview */}
            <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <p className="text-sm text-gray-400">Total Promociones</p>
                <p className="text-2xl font-bold text-white">
                  {metrics.overview.totalPromotions}
                </p>
              </div>
              <div className="rounded-lg border border-green-700/50 bg-green-900/20 p-4">
                <p className="text-sm text-green-400">Activas</p>
                <p className="text-2xl font-bold text-green-400">
                  {metrics.overview.activePromotions}
                </p>
              </div>
              <div className="rounded-lg border border-purple-700/50 bg-purple-900/20 p-4">
                <p className="text-sm text-purple-400">Ingresos Totales</p>
                <p className="text-xl font-bold text-purple-400">
                  {formatCurrency(metrics.overview.totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-blue-700/50 bg-blue-900/20 p-4">
                <p className="text-sm text-blue-400">Unidades Vendidas</p>
                <p className="text-2xl font-bold text-blue-400">
                  {metrics.overview.totalUnitsSold}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-4">
                <p className="text-sm text-yellow-400">Ahorro Generado</p>
                <p className="text-xl font-bold text-yellow-400">
                  {formatCurrency(metrics.overview.totalSavings)}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Top Selling */}
              <div>
                <h3 className="mb-3 font-medium text-white">🏆 Más Vendidas</h3>
                <div className="space-y-2">
                  {metrics.topSelling.map((promo, idx) => (
                    <div
                      key={promo._id}
                      className="flex items-center gap-3 rounded-lg bg-gray-800/50 p-3"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-900/50 text-xs font-bold text-purple-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">
                          {promo.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {promo.unitsSold} vendidas
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-green-400">
                        {formatCurrency(promo.revenue)}
                      </span>
                    </div>
                  ))}
                  {metrics.topSelling.length === 0 && (
                    <p className="py-4 text-center text-gray-500">
                      Sin datos aún
                    </p>
                  )}
                </div>
              </div>

              {/* Top Revenue */}
              <div>
                <h3 className="mb-3 font-medium text-white">
                  💰 Más Rentables
                </h3>
                <div className="space-y-2">
                  {metrics.topRevenue.map((promo, idx) => (
                    <div
                      key={promo._id}
                      className="flex items-center gap-3 rounded-lg bg-gray-800/50 p-3"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-900/50 text-xs font-bold text-green-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">
                          {promo.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {promo.unitsSold} vendidas
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-purple-400">
                        {formatCurrency(promo.revenue)}
                      </span>
                    </div>
                  ))}
                  {metrics.topRevenue.length === 0 && (
                    <p className="py-4 text-center text-gray-500">
                      Sin datos aún
                    </p>
                  )}
                </div>
              </div>

              {/* Top Products */}
              <div>
                <h3 className="mb-3 font-medium text-white">
                  📦 Productos Más Usados
                </h3>
                <div className="space-y-2">
                  {metrics.topProducts.map((product, idx) => (
                    <div
                      key={product.productId}
                      className="flex items-center gap-3 rounded-lg bg-gray-800/50 p-3"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-900/50 text-xs font-bold text-blue-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          En {product.count} promociones
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-orange-400">
                        {product.quantity} uds
                      </span>
                    </div>
                  ))}
                  {metrics.topProducts.length === 0 && (
                    <p className="py-4 text-center text-gray-500">
                      Sin datos aún
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowMetrics(false)}
                className="rounded-lg bg-purple-600 px-6 py-2 font-medium text-white transition hover:bg-purple-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
