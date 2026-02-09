import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/components/ui";
import { branchService } from "../../branches/services";
import type { Branch, BranchStock } from "../../business/types/business.types";
import {
  productService,
  stockService,
} from "../../inventory/services/inventory.service";
import type { Product } from "../../inventory/types/product.types";

interface FormState {
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  timezone: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  address: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  timezone: "America/Bogota",
};

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedBranchInventory, setSelectedBranchInventory] =
    useState<Branch | null>(null);
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [searchStock, setSearchStock] = useState("");

  const activeCount = useMemo(
    () => branches.filter(b => b.active !== false).length,
    [branches]
  );

  useEffect(() => {
    void loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await branchService.list();
      setBranches(data || []);
    } catch (err) {
      console.error("loadBranches", err);
      setError("No se pudieron cargar las sedes");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio");
      return;
    }
    try {
      setSaving(true);
      const response = await branchService.create({
        name: trimmedName,
        address: form.address.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      });
      const branch = (response as any).branch || response;
      setBranches(prev => [branch, ...prev]);
      setForm(DEFAULT_FORM);
      setSuccess("Sede creada correctamente");
    } catch (err) {
      console.error("createBranch", err);
      setError("No se pudo crear la sede");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (branch: Branch) => {
    setError("");
    setSuccess("");
    setUpdatingId(branch._id);
    try {
      const updateRes = await branchService.update(branch._id, {
        active: branch.active === false ? true : false,
      });
      const updated = (updateRes as any).branch || updateRes;
      setBranches(prev => prev.map(b => (b._id === branch._id ? updated : b)));
      setSuccess(
        `Sede ${updated.active === false ? "desactivada" : "activada"}`
      );
    } catch (err) {
      console.error("toggleActive", err);
      setError("No se pudo actualizar el estado de la sede");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (branch: Branch) => {
    const confirmDelete = window.confirm(
      `¿Eliminar la sede "${branch.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;
    setError("");
    setSuccess("");
    setDeletingId(branch._id);
    try {
      await branchService.remove(branch._id);
      setBranches(prev => prev.filter(b => b._id !== branch._id));
      setSuccess("Sede eliminada");
    } catch (err) {
      console.error("deleteBranch", err);
      setError("No se pudo eliminar la sede");
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewInventory = async (branch: Branch) => {
    setSelectedBranchInventory(branch);
    setShowInventoryModal(true);
    setLoadingStock(true);
    setBranchStock([]);
    setSearchStock("");

    try {
      console.log(
        `[DEBUG] Cargando inventario para sede: ${branch.name} (${branch._id})`
      );
      console.log(`[DEBUG] isWarehouse: ${branch.isWarehouse}`);

      if (branch.isWarehouse) {
        // Para bodega, cargar desde warehouseStock de los productos
        const productsData = await productService.getAll();
        const productsList = Array.isArray(productsData)
          ? productsData
          : productsData.data || [];
        const warehouseStock: BranchStock[] = productsList
          .filter((p: Product) => (p.warehouseStock || 0) > 0)
          .map((p: Product) => ({
            _id: `warehouse-${p._id}`,
            product: p,
            quantity: p.warehouseStock || 0,
            branch: branch._id,
            lowStockAlert: p.lowStockAlert || 10,
          }));
        console.log(`[DEBUG] Warehouse stock items: ${warehouseStock.length}`);
        setBranchStock(warehouseStock);
      } else {
        // Para sedes normales, cargar desde BranchStock
        const stockData = await stockService.getBranchStock(branch._id);
        const stockList = Array.isArray(stockData) ? stockData : [];
        console.log(`[DEBUG] Stock recibido:`, stockList);
        console.log(`[DEBUG] Cantidad de items: ${stockList.length || 0}`);
        setBranchStock(stockList);
      }
    } catch (err) {
      console.error("Error al cargar inventario:", err);
      setError("No se pudo cargar el inventario de la sede");
    } finally {
      setLoadingStock(false);
    }
  };

  const filteredStock = branchStock.filter(item => {
    const product = typeof item.product === "object" ? item.product : null;
    const productName = product?.name?.toLowerCase() || "";
    return productName.includes(searchStock.toLowerCase());
  });

  const totalProducts = branchStock.length;
  const totalUnits = branchStock.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  // Valor invertido: lo que costó comprar el inventario
  const totalInvested = branchStock.reduce((sum, item) => {
    const product = typeof item.product === "object" ? item.product : null;
    const purchasePrice = product?.purchasePrice || 0;
    return sum + purchasePrice * (item.quantity || 0);
  }, 0);

  // Valor de venta estimado: lo que se recibiría vendiendo todo
  const totalSalesValue = branchStock.reduce((sum, item) => {
    const product = typeof item.product === "object" ? item.product : null;
    const clientPrice = product?.clientPrice || 0;
    return sum + clientPrice * (item.quantity || 0);
  }, 0);

  // Ganancia estimada: diferencia entre venta e inversión
  const totalEstimatedProfit = totalSalesValue - totalInvested;

  return (
    <div className="space-y-6 overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold text-white">Sedes</h1>
        <p className="mt-2 text-gray-400">
          Crea y administra las sedes desde las que venderás y llevarás
          inventario.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 shadow-lg"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Crear sede</h2>
            <span className="text-xs text-gray-400">Zona horaria opcional</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ej. Sede Centro"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Dirección
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Calle 123 #45-67"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Contacto
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={form.contactName}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nombre de contacto"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={form.contactPhone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="3001234567"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={form.contactEmail}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Zona horaria
                </label>
                <select
                  name="timezone"
                  value={form.timezone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="America/Bogota">America/Bogota</option>
                  <option value="America/Mexico_City">
                    America/Mexico_City
                  </option>
                  <option value="America/Lima">America/Lima</option>
                  <option value="America/Santiago">America/Santiago</option>
                  <option value="America/Argentina/Buenos_Aires">
                    America/Argentina/Buenos_Aires
                  </option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Crear sede"}
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-5 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Listado</h2>
                <p className="text-sm text-gray-400">
                  {loading
                    ? "Cargando sedes..."
                    : `${branches.length} sede(s), ${activeCount} activas`}
                </p>
              </div>
              <button
                onClick={() => void loadBranches()}
                className="rounded-lg border border-gray-600 px-3 py-1 text-xs font-semibold text-gray-200 transition hover:border-purple-500 hover:text-white"
                disabled={loading}
              >
                Recargar
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 text-gray-400">
                Cargando...
              </div>
            ) : branches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/40 p-6 text-center text-gray-400">
                No hay sedes registradas.
              </div>
            ) : (
              branches.map((branch, index) => (
                <div
                  key={branch._id || `${branch.name}-${index}`}
                  className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-white">
                          {branch.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${branch.active === false ? "bg-red-500/20 text-red-300" : "bg-green-500/15 text-green-200"}`}
                        >
                          {branch.active === false ? "Inactiva" : "Activa"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {branch.address || "Sin dirección"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {branch.contactName || "Sin contacto"}
                        {branch.contactPhone ? ` · ${branch.contactPhone}` : ""}
                        {branch.contactEmail ? ` · ${branch.contactEmail}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">{branch.timezone}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleViewInventory(branch)}
                        className="rounded-lg border border-blue-600/60 bg-blue-600/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:border-blue-500 hover:bg-blue-600/20 hover:text-white"
                      >
                        <svg
                          className="mr-1.5 inline h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                        Ver Inventario
                      </button>
                      <button
                        onClick={() => handleToggleActive(branch)}
                        disabled={updatingId === branch._id}
                        className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:border-purple-500 hover:text-white disabled:opacity-60"
                      >
                        {branch.active === false ? "Activar" : "Desactivar"}
                      </button>
                      <button
                        onClick={() => handleDelete(branch)}
                        disabled={deletingId === branch._id}
                        className="rounded-lg border border-red-700/60 px-3 py-2 text-xs font-semibold text-red-200 transition hover:border-red-600 hover:text-white disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de Inventario */}
      {showInventoryModal && selectedBranchInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-xl border border-gray-700 bg-gray-800 shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-700 p-4 sm:p-6">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold text-white sm:text-2xl">
                  Inventario - {selectedBranchInventory.name}
                </h2>
                <p className="mt-1 truncate text-xs text-gray-400 sm:text-sm">
                  {selectedBranchInventory.address || "Sin dirección"}
                </p>
              </div>
              <button
                onClick={() => setShowInventoryModal(false)}
                className="ml-4 shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-white"
              >
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Stats */}
            {!loadingStock && (
              <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-gray-700 p-4 sm:grid-cols-4 sm:gap-4 sm:p-6">
                <div className="rounded-lg border border-gray-600 bg-gray-900/50 p-2 sm:p-4">
                  <p className="text-[10px] text-gray-400 sm:text-sm">
                    Total Productos
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-white sm:mt-1 sm:text-2xl">
                    {totalProducts}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-600 bg-gray-900/50 p-2 sm:p-4">
                  <p className="text-[10px] text-gray-400 sm:text-sm">
                    Total Unidades
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-white sm:mt-1 sm:text-2xl">
                    {totalUnits}
                  </p>
                </div>
                <div className="rounded-lg border border-orange-600 bg-orange-900/30 p-2 sm:p-4">
                  <p className="text-[10px] text-orange-400 sm:text-sm">
                    Valor Invertido
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-orange-300 sm:mt-1 sm:text-2xl">
                    ${totalInvested.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-600 bg-blue-900/30 p-2 sm:p-4">
                  <p className="text-[10px] text-blue-400 sm:text-sm">
                    Valor de Venta
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-blue-300 sm:mt-1 sm:text-2xl">
                    ${totalSalesValue.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Ganancia Estimada - Fila adicional */}
            {!loadingStock && (
              <div className="shrink-0 border-b border-gray-700 px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="rounded-lg border-2 border-green-600 bg-green-900/40 p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-400 sm:text-sm">
                        💰 Ganancia Estimada Total
                      </p>
                      <p className="mt-0.5 text-xs text-green-500 sm:text-sm">
                        Si vendes todo el inventario
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-green-300 sm:text-3xl">
                      ${totalEstimatedProfit.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="shrink-0 border-b border-gray-700 p-4 sm:p-6">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchStock}
                  onChange={e => setSearchStock(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full rounded-lg border border-gray-600 bg-gray-900/50 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none sm:py-2.5 sm:pl-10"
                />
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {loadingStock ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-purple-500"></div>
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/40 py-8 text-center sm:py-12">
                  <svg
                    className="mx-auto h-10 w-10 text-gray-600 sm:h-12 sm:w-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="mt-4 text-sm text-gray-400 sm:text-base">
                    {searchStock
                      ? "No se encontraron productos"
                      : "Esta sede no tiene inventario registrado"}
                  </p>
                  <p className="mt-2 px-4 text-xs text-gray-500 sm:text-sm">
                    {branchStock.length === 0 && !searchStock
                      ? "Para agregar inventario a esta sede, ve a Inventario → Transferencias o registra una entrada de stock."
                      : ""}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-900/80">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase text-gray-400 sm:px-4 sm:py-3 sm:text-xs">
                          Producto
                        </th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-medium uppercase text-gray-400 sm:px-4 sm:py-3 sm:text-xs">
                          Cantidad
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-medium uppercase text-gray-400 sm:px-4 sm:py-3 sm:text-xs">
                          P. Compra
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-medium uppercase text-gray-400 sm:px-4 sm:py-3 sm:text-xs">
                          P. Venta
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-medium uppercase text-green-400 sm:px-4 sm:py-3 sm:text-xs">
                          Ganancia Est.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {filteredStock.map(item => {
                        const product =
                          typeof item.product === "object"
                            ? item.product
                            : null;
                        const purchasePrice = product?.purchasePrice || 0;
                        const clientPrice = product?.clientPrice || 0;
                        const quantity = item.quantity || 0;
                        const profitPerUnit = clientPrice - purchasePrice;
                        const totalProfit = profitPerUnit * quantity;

                        return (
                          <tr key={item._id} className="hover:bg-gray-800/50">
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <div className="flex items-center gap-2 sm:gap-3">
                                {product?.image?.url && (
                                  <img
                                    src={product.image.url}
                                    alt={product.name}
                                    className="h-8 w-8 shrink-0 rounded object-cover sm:h-10 sm:w-10"
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-white sm:text-sm">
                                    {product?.name || "Producto sin nombre"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center sm:px-4 sm:py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium sm:px-2.5 sm:text-sm ${
                                  quantity === 0
                                    ? "bg-red-500/20 text-red-300"
                                    : quantity < 10
                                      ? "bg-yellow-500/20 text-yellow-300"
                                      : "bg-green-500/20 text-green-300"
                                }`}
                              >
                                {quantity}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-gray-400 sm:px-4 sm:py-3 sm:text-sm">
                              ${purchasePrice.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-white sm:px-4 sm:py-3 sm:text-sm">
                              ${clientPrice.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-green-400 sm:px-4 sm:py-3 sm:text-sm">
                              ${totalProfit.toLocaleString()}
                              {profitPerUnit > 0 && (
                                <span className="ml-1 text-[10px] text-green-500 sm:text-xs">
                                  (+${profitPerUnit.toLocaleString()}/u)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-gray-700 p-4 sm:p-6">
              <button
                onClick={() => setShowInventoryModal(false)}
                className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:text-white sm:px-6 sm:py-2.5"
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
