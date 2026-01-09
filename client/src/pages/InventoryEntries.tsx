import {
  ArrowDownToLine,
  Building2,
  Calendar,
  Edit2,
  Filter,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  branchService,
  categoryService,
  inventoryService,
  productService,
  providerService,
} from "../api/services";
import ProductSelector from "../components/ProductSelector";
import type { Product } from "../types";

interface InventoryEntry {
  _id: string;
  product: { _id: string; name: string };
  branch?: { _id: string; name: string };
  provider?: { _id: string; name: string };
  user: { _id: string; name: string };
  quantity: number;
  notes?: string;
  destination: "branch" | "warehouse";
  requestId: string;
  createdAt: string;
}

interface Provider {
  _id: string;
  name: string;
}

interface Branch {
  _id: string;
  name: string;
  isWarehouse?: boolean;
}

export default function InventoryEntries() {
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [_products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<InventoryEntry | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Edit form
  const [editFormData, setEditFormData] = useState({
    notes: "",
    provider: "",
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDestination, setFilterDestination] = useState<string>("");
  const [filterProvider, setFilterProvider] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Cart for multiple products
  const [cart, setCart] = useState<
    Array<{
      id: string;
      product: string;
      productName: string;
      quantity: number;
      branch: string;
      provider: string;
      notes: string;
    }>
  >([]);

  // Form
  const [formData, setFormData] = useState({
    product: "",
    quantity: "",
    branch: "",
    provider: "",
    notes: "",
  });

  // New product form
  const [newProductData, setNewProductData] = useState({
    name: "",
    description: "",
    purchasePrice: "",
    suggestedPrice: "",
    distributorPrice: "",
    clientPrice: "",
    category: "",
    totalStock: "",
    lowStockAlert: "10",
    featured: false,
    ingredients: "",
    benefits: "",
  });
  const [distributorManual, setDistributorManual] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const params: Record<string, string | number> = { page, limit: 20 };
      if (filterDestination) params.destination = filterDestination;
      if (filterProvider) params.providerId = filterProvider;
      if (filterStartDate) params.startDate = filterStartDate;
      if (filterEndDate) params.endDate = filterEndDate;

      const [
        entriesRes,
        productsRes,
        providersRes,
        branchesRes,
        categoriesRes,
      ] = await Promise.all([
        inventoryService.getEntries(
          params as Parameters<typeof inventoryService.getEntries>[0]
        ),
        productService.getAll({ limit: 1000 }),
        providerService.getAll(),
        branchService.list(),
        categoryService.getAll(),
      ]);

      setEntries(entriesRes.entries);
      setTotalPages(entriesRes.pagination?.pages || 1);
      setProducts(productsRes.data);
      setProviders(providersRes.providers);
      setBranches(branchesRes);
      setCategories(categoriesRes);
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setError("Error al cargar el historial de entradas");
    } finally {
      setLoading(false);
    }
  }, [page, filterDestination, filterProvider, filterStartDate, filterEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddToCart = () => {
    if (!formData.product || !formData.quantity) {
      setError("Selecciona un producto y cantidad");
      return;
    }

    const productInfo = _products.find(p => p._id === formData.product);
    if (!productInfo) {
      setError("Producto no encontrado");
      return;
    }

    const cartItem = {
      id: Date.now().toString() + Math.random().toString(36),
      product: formData.product,
      productName: productInfo.name,
      quantity: parseInt(formData.quantity),
      branch: formData.branch,
      provider: formData.provider,
      notes: formData.notes,
    };

    setCart([...cart, cartItem]);

    // Clear form except branch and provider (to reuse for next product)
    setFormData({
      ...formData,
      product: "",
      quantity: "",
      notes: "",
    });
    setError("");
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      setError("Agrega al menos un producto al carrito");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Create all entries sequentially
      for (const item of cart) {
        await inventoryService.createEntry({
          product: item.product,
          quantity: item.quantity,
          branch: item.branch || undefined,
          provider: item.provider || undefined,
          notes: item.notes || undefined,
        });
      }

      setShowModal(false);
      setCart([]);
      setFormData({
        product: "",
        quantity: "",
        branch: "",
        provider: "",
        notes: "",
      });
      loadData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al registrar las entradas";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const purchasePrice = Number(newProductData.purchasePrice);
      const distributorPrice = Number(newProductData.distributorPrice);
      const totalStock = Number(newProductData.totalStock || 0);
      const clientPrice = newProductData.clientPrice
        ? Number(newProductData.clientPrice)
        : undefined;

      if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
        throw new Error("El precio de compra debe ser un número válido");
      }

      if (Number.isNaN(distributorPrice) || distributorPrice < 0) {
        throw new Error("El precio de distribuidor debe ser un número válido");
      }

      if (Number.isNaN(totalStock) || totalStock < 0) {
        throw new Error("El stock debe ser un número válido");
      }

      const ingredients = newProductData.ingredients
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

      const benefits = newProductData.benefits
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

      const response = await productService.create({
        name: newProductData.name.trim(),
        description: newProductData.description.trim(),
        purchasePrice,
        suggestedPrice:
          Number(newProductData.suggestedPrice) || purchasePrice * 1.3,
        distributorPrice,
        clientPrice,
        category: newProductData.category,
        totalStock,
        lowStockAlert: Number(newProductData.lowStockAlert) || 10,
        featured: newProductData.featured,
        ingredients,
        benefits,
        imageFile: imageFile || undefined,
      });

      // Recargar productos
      const productsRes = await productService.getAll({ limit: 1000 });
      setProducts(productsRes.data);

      // Seleccionar el nuevo producto automáticamente
      setFormData({ ...formData, product: response._id });

      // Cerrar modal y limpiar form
      setShowProductModal(false);
      setNewProductData({
        name: "",
        description: "",
        purchasePrice: "",
        suggestedPrice: "",
        distributorPrice: "",
        clientPrice: "",
        category: "",
        totalStock: "",
        lowStockAlert: "10",
        featured: false,
        ingredients: "",
        benefits: "",
      });
      setImageFile(null);
      setImagePreview(null);
      setDistributorManual(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al crear el producto";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (entry: InventoryEntry) => {
    setSelectedEntry(entry);
    setEditFormData({
      notes: entry.notes || "",
      provider: entry.provider?._id || "",
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;

    setSaving(true);
    setError("");

    try {
      await inventoryService.updateEntry(selectedEntry._id, {
        notes: editFormData.notes || undefined,
        provider: editFormData.provider || null,
      });

      setShowEditModal(false);
      setSelectedEntry(null);
      loadData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al editar la entrada";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (entry: InventoryEntry) => {
    setSelectedEntry(entry);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedEntry) return;

    setDeleting(true);
    setError("");

    try {
      await inventoryService.deleteEntry(selectedEntry._id);
      setShowDeleteConfirm(false);
      setSelectedEntry(null);
      loadData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al eliminar la entrada";
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredEntries = entries.filter(
    entry =>
      entry.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.provider?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.requestId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearFilters = () => {
    setSearchTerm("");
    setFilterDestination("");
    setFilterProvider("");
    setFilterStartDate("");
    setFilterEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Historial de Entradas
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Registro de todas las entradas de inventario.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
        >
          <Plus className="h-5 w-5" />
          Nueva Entrada
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por producto, proveedor o ID..."
            className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <select
          value={filterDestination}
          onChange={e => {
            setFilterDestination(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="">Todo destino</option>
          <option value="warehouse">Bodega</option>
          <option value="branch">Sede</option>
        </select>

        <select
          value={filterProvider}
          onChange={e => {
            setFilterProvider(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="">Todos los proveedores</option>
          {providers.map(p => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          onClick={clearFilters}
          className="rounded-lg border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-700"
        >
          <Filter className="mr-2 inline h-4 w-4" />
          Limpiar
        </button>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={filterStartDate}
            onChange={e => {
              setFilterStartDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
          />
          <span className="text-gray-400">a</span>
          <input
            type="date"
            value={filterEndDate}
            onChange={e => {
              setFilterEndDate(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
          <ArrowDownToLine className="mx-auto h-12 w-12 text-gray-600" />
          <h3 className="mt-4 text-lg font-medium text-white">
            No hay entradas registradas
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            Registra entradas de inventario cuando recibas mercancía.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Registrar Entrada
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-700 bg-gray-800/80">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    Destino
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    Proveedor
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredEntries.map(entry => (
                  <tr key={entry._id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <code className="text-xs text-purple-400">
                        {entry.requestId?.slice(-8) || entry._id.slice(-8)}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-white">
                          {entry.product?.name || "Producto eliminado"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        +{entry.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {entry.destination === "warehouse" ? (
                          <>
                            <Warehouse className="h-4 w-4 text-blue-400" />
                            <span className="text-gray-300">Bodega</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="h-4 w-4 text-orange-400" />
                            <span className="text-gray-300">
                              {entry.branch?.name || "Sede"}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.provider ? (
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">
                            {entry.provider.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {entry.user?.name || "Sistema"}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(entry.createdAt).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(entry)}
                          className="rounded p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-blue-400"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(entry)}
                          className="rounded p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-red-400"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-400">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal con Carrito */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-5xl rounded-xl border border-gray-700 bg-gray-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Registrar Entrada de Inventario
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Limpiar carrito
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Formulario */}
              <div className="space-y-4">
                <h3 className="font-semibold text-white">Agregar Producto</h3>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">
                      Producto *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                    >
                      <Plus className="h-3 w-3" />
                      Crear producto
                    </button>
                  </div>
                  <ProductSelector
                    value={formData.product}
                    onChange={productId =>
                      setFormData({ ...formData, product: productId })
                    }
                    placeholder="Buscar y seleccionar producto..."
                    showStock={true}
                    className="mt-1"
                    excludeProductIds={cart.map(item => item.product)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={e =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    min="1"
                    placeholder="Ej: 50"
                    className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Destino
                  </label>
                  <select
                    value={formData.branch}
                    onChange={e =>
                      setFormData({ ...formData, branch: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Bodega principal</option>
                    {branches
                      .filter(b => !b.isWarehouse)
                      .map(b => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Deja vacío para enviar a bodega principal
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Proveedor
                  </label>
                  <select
                    value={formData.provider}
                    onChange={e =>
                      setFormData({ ...formData, provider: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Sin proveedor</option>
                    {providers.map(p => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Notas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={e =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Observaciones adicionales..."
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Plus className="mr-1 inline h-4 w-4" />
                  Agregar al Carrito
                </button>
              </div>

              {/* Carrito */}
              <div className="flex flex-col">
                <h3 className="mb-3 font-semibold text-white">
                  Carrito ({cart.length}{" "}
                  {cart.length === 1 ? "producto" : "productos"})
                </h3>

                <div className="flex-1 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                  {cart.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <p className="text-sm text-gray-500">
                        No hay productos en el carrito.
                        <br />
                        Agrega productos usando el formulario.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(item => {
                        const branchName = item.branch
                          ? branches.find(b => b._id === item.branch)?.name
                          : "Bodega principal";
                        const providerName = item.provider
                          ? providers.find(p => p._id === item.provider)?.name
                          : "Sin proveedor";

                        return (
                          <div
                            key={item.id}
                            className="rounded-lg border border-gray-700 bg-gray-800 p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-white">
                                  {item.productName}
                                </h4>
                                <div className="mt-1 space-y-1 text-xs text-gray-400">
                                  <p>Cantidad: {item.quantity}</p>
                                  <p>Destino: {branchName}</p>
                                  <p>Proveedor: {providerName}</p>
                                  {item.notes && <p>Notas: {item.notes}</p>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(item.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-lg bg-gray-900/50 p-3">
                  <p className="text-sm text-gray-400">
                    Total de productos:{" "}
                    <span className="font-semibold text-white">
                      {cart.length}
                    </span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Total unidades:{" "}
                    <span className="font-semibold text-white">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setFormData({
                    product: "",
                    quantity: "",
                    branch: "",
                    provider: "",
                    notes: "",
                  });
                  handleClearCart();
                }}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || cart.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar {cart.length}{" "}
                {cart.length === 1 ? "Entrada" : "Entradas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Producto */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-4xl rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
              <h2 className="mb-6 text-2xl font-bold text-white">
                Agregar producto
              </h2>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateProduct} className="space-y-6">
                <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
                  <div className="space-y-6">
                    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
                      <h3 className="mb-4 text-lg font-semibold text-white">
                        Información principal
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-300">
                            Nombre *
                          </label>
                          <input
                            type="text"
                            value={newProductData.name}
                            onChange={e =>
                              setNewProductData({
                                ...newProductData,
                                name: e.target.value,
                              })
                            }
                            required
                            className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Nombre del producto"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-300">
                            Descripción *
                          </label>
                          <textarea
                            value={newProductData.description}
                            onChange={e =>
                              setNewProductData({
                                ...newProductData,
                                description: e.target.value,
                              })
                            }
                            required
                            rows={4}
                            className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Describe el producto y sus beneficios"
                          />
                        </div>

                        {/* Panel de Rentabilidad */}
                        <div className="rounded-lg border border-purple-500/30 bg-purple-900/20 p-4">
                          <h4 className="mb-3 text-sm font-semibold text-purple-300">
                            💰 Precios y Rentabilidad
                          </h4>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs font-medium text-gray-300">
                                Precio de Compra *
                              </label>
                              <input
                                type="number"
                                value={newProductData.purchasePrice}
                                onChange={e => {
                                  const purchase = Number(e.target.value);
                                  setNewProductData({
                                    ...newProductData,
                                    purchasePrice: e.target.value,
                                    suggestedPrice:
                                      !isNaN(purchase) && purchase > 0
                                        ? Math.round(purchase * 1.3).toString()
                                        : "",
                                  });
                                }}
                                required
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="0.00"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-medium text-green-300">
                                Precio Sugerido (30%) *
                              </label>
                              <input
                                type="number"
                                value={newProductData.suggestedPrice}
                                onChange={e =>
                                  setNewProductData({
                                    ...newProductData,
                                    suggestedPrice: e.target.value,
                                  })
                                }
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-green-600 bg-green-900/20 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Calculado automático"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Se calcula automáticamente al ingresar precio de
                                compra
                              </p>
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-medium text-blue-300">
                                Precio Distribuidor *
                              </label>
                              <input
                                type="number"
                                value={newProductData.distributorPrice}
                                onChange={e => {
                                  setNewProductData({
                                    ...newProductData,
                                    distributorPrice: e.target.value,
                                  });
                                  setDistributorManual(e.target.value !== "");
                                }}
                                required
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-blue-600 bg-blue-900/20 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Se calcula automáticamente (editable)"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Se calcula como 80% del precio cliente, pero
                                puedes ajustarlo
                              </p>
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-medium text-gray-300">
                                Precio Cliente *
                              </label>
                              <input
                                type="number"
                                value={newProductData.clientPrice}
                                onChange={e => {
                                  const client = Number(e.target.value);
                                  const updates: Partial<
                                    typeof newProductData
                                  > = {
                                    clientPrice: e.target.value,
                                  };
                                  if (!distributorManual && !isNaN(client)) {
                                    updates.distributorPrice = Math.round(
                                      client * 0.8
                                    ).toString();
                                  }
                                  setNewProductData({
                                    ...newProductData,
                                    ...updates,
                                  });
                                }}
                                required
                                min="0"
                                step="0.01"
                                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Stock */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-300">
                              Stock Total *
                            </label>
                            <input
                              type="number"
                              value={newProductData.totalStock}
                              onChange={e =>
                                setNewProductData({
                                  ...newProductData,
                                  totalStock: e.target.value,
                                })
                              }
                              required
                              min="0"
                              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Cantidad total"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Irá automáticamente a bodega
                            </p>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-300">
                              Alerta Stock Bajo
                            </label>
                            <input
                              type="number"
                              value={newProductData.lowStockAlert}
                              onChange={e =>
                                setNewProductData({
                                  ...newProductData,
                                  lowStockAlert: e.target.value,
                                })
                              }
                              min="0"
                              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="10"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-300">
                              Categoría
                            </label>
                            <select
                              value={newProductData.category}
                              onChange={e =>
                                setNewProductData({
                                  ...newProductData,
                                  category: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">Selecciona una categoría</option>
                              {categories.map(cat => (
                                <option key={cat._id} value={cat._id}>
                                  {cat.name.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3">
                            <input
                              id="featured"
                              type="checkbox"
                              checked={newProductData.featured}
                              onChange={e =>
                                setNewProductData({
                                  ...newProductData,
                                  featured: e.target.checked,
                                })
                              }
                              className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                            />
                            <label
                              htmlFor="featured"
                              className="text-sm text-gray-300"
                            >
                              Destacar producto
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Información adicional */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
                      <h3 className="mb-4 text-lg font-semibold text-white">
                        Información adicional
                      </h3>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-300">
                            Ingredientes (separados por coma)
                          </label>
                          <textarea
                            value={newProductData.ingredients}
                            onChange={e =>
                              setNewProductData({
                                ...newProductData,
                                ingredients: e.target.value,
                              })
                            }
                            rows={3}
                            className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Ej: Nicotina, Propilenglicol, Glicerina"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-300">
                            Beneficios (separados por coma)
                          </label>
                          <textarea
                            value={newProductData.benefits}
                            onChange={e =>
                              setNewProductData({
                                ...newProductData,
                                benefits: e.target.value,
                              })
                            }
                            rows={3}
                            className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Ej: Sabor intenso, Alta duración"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Imagen */}
                  <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
                    <h3 className="mb-4 text-lg font-semibold text-white">
                      Imagen
                    </h3>

                    <div className="flex flex-col gap-4">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Vista previa"
                          className="h-56 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-600 text-gray-500">
                          Vista previa
                        </div>
                      )}

                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-6 text-center text-sm text-gray-400 transition hover:border-purple-500 hover:text-purple-300">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImageFile(file);
                              setImagePreview(URL.createObjectURL(file));
                            }
                          }}
                          className="hidden"
                        />
                        <span className="font-medium text-white">
                          Subir imagen
                        </span>
                        <span>
                          Formatos permitidos: JPG, PNG, WebP (máx. 5MB)
                        </span>
                      </label>
                    </div>
                  </div>
                </section>

                <div className="flex justify-end gap-4 border-t border-gray-700 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductModal(false);
                      setNewProductData({
                        name: "",
                        description: "",
                        purchasePrice: "",
                        suggestedPrice: "",
                        distributorPrice: "",
                        clientPrice: "",
                        category: "",
                        totalStock: "",
                        lowStockAlert: "10",
                        featured: false,
                        ingredients: "",
                        benefits: "",
                      });
                      setImageFile(null);
                      setImagePreview(null);
                      setDistributorManual(false);
                      setError("");
                    }}
                    className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-gray-300 transition hover:border-purple-500 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-5 w-5 animate-spin" />}
                    {saving ? "Guardando..." : "Guardar producto"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Editar Entrada</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedEntry(null);
                  setError("");
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-gray-700/50 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-purple-400" />
                <span className="font-medium text-white">
                  {selectedEntry.product?.name}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-xs text-gray-400">
                <span>Cantidad: +{selectedEntry.quantity}</span>
                <span>
                  Destino:{" "}
                  {selectedEntry.destination === "warehouse"
                    ? "Bodega"
                    : selectedEntry.branch?.name}
                </span>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Proveedor
                </label>
                <select
                  value={editFormData.provider}
                  onChange={e =>
                    setEditFormData({
                      ...editFormData,
                      provider: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Sin proveedor</option>
                  {providers.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Notas
                </label>
                <textarea
                  value={editFormData.notes}
                  onChange={e =>
                    setEditFormData({ ...editFormData, notes: e.target.value })
                  }
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  placeholder="Observaciones adicionales..."
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedEntry(null);
                    setError("");
                  }}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-gray-300 hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-500/20 p-3">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Eliminar entrada
                </h2>
                <p className="text-sm text-gray-400">
                  Esta acción no se puede deshacer
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-gray-300">
                Se eliminará la entrada de{" "}
                <strong className="text-white">
                  {selectedEntry.product?.name}
                </strong>{" "}
                y se revertirá el stock:
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="font-medium text-red-400">
                  -{selectedEntry.quantity} unidades
                </span>
                <span className="text-gray-400">
                  de{" "}
                  {selectedEntry.destination === "warehouse"
                    ? "Bodega"
                    : selectedEntry.branch?.name || "Sede"}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedEntry(null);
                  setError("");
                }}
                className="rounded-lg border border-gray-600 px-4 py-2 text-gray-300 hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar y revertir stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
