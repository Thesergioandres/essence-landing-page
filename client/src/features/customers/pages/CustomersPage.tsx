import {
  AlertTriangle,
  Award,
  CreditCard,
  Edit,
  Eye,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import CustomerPointsCard from "../../../components/CustomerPointsCard";
import { authService } from "../../auth/services";
import { customerService } from "../services/customer.service";
import type { Customer } from "../types/customer.types";

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const segmentConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  new: {
    label: "Nuevo",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: <UserCircle className="h-4 w-4" />,
  },
  frequent: {
    label: "Frecuente",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  vip: {
    label: "VIP",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    icon: <Star className="h-4 w-4" />,
  },
  inactive: {
    label: "Inactivo",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    icon: <Users className="h-4 w-4" />,
  },
};

export default function Customers() {
  const user = authService.getCurrentUser();
  const isEmployee = user?.role === "employee";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSegment, setFilterSegment] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MÃ©tricas
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    totalVip: 0,
    totalDebt: 0,
    avgSpend: 0,
  });

  const getSegmentKey = (segment: Customer["segment"]) => {
    if (!segment) return "";
    if (typeof segment === "string") return segment;
    return segment.key || segment.name || "";
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { customers: customerList } = await customerService.getAll();
      setCustomers(customerList);

      // Calcular mÃ©tricas - segment ahora puede ser objeto o string
      const totalVip = customerList.filter(c => {
        const segmentKey = getSegmentKey(c.segment);
        return segmentKey.toLowerCase() === "vip";
      }).length;
      const totalDebt = customerList.reduce(
        (acc, c) => acc + (c.totalDebt || 0),
        0
      );
      const avgSpend =
        customerList.length > 0
          ? customerList.reduce((acc, c) => acc + (c.totalSpend || 0), 0) /
            customerList.length
          : 0;

      setMetrics({
        totalCustomers: customerList.length,
        totalVip,
        totalDebt,
        avgSpend,
      });

      console.warn("[Essence Debug]", "[UI INFO] customers_loaded", { count: customerList.length });
    } catch (err) {
      console.error("[UI ERROR] customers_fetch_failed", err);
      setError("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingCustomer) {
        await customerService.update(editingCustomer._id, formData);
        console.warn("[Essence Debug]", "[UI INFO] customer_updated", { id: editingCustomer._id });
      } else {
        await customerService.create(formData);
        console.warn("[Essence Debug]", "[UI INFO] customer_created");
      }
      setShowModal(false);
      setEditingCustomer(null);
      resetForm();
      fetchCustomers();
    } catch (err) {
      console.error("[UI ERROR] customer_save_failed", err);
      setError("Error al guardar cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setShowModal(true);
  };

  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Â¿EstÃ¡s seguro de eliminar este cliente?")) return;

    try {
      await customerService.delete(id);
      console.warn("[Essence Debug]", "[UI INFO] customer_deleted", { id });
      fetchCustomers();
    } catch (err) {
      console.error("[UI ERROR] customer_delete_failed", err);
      setError("Error al eliminar cliente");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment =
      filterSegment === "all" || getSegmentKey(c.segment) === filterSegment;
    return matchesSearch && matchesSegment;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-gray-400 sm:mt-2 sm:text-base">
            Gestiona tu base de clientes y CRM
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCustomer(null);
            setShowModal(true);
          }}
          className="flex min-h-12 items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          Nuevo Cliente
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* MÃ©tricas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {metrics.totalCustomers}
              </p>
              <p className="text-sm text-gray-400">Total Clientes</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/20 p-2">
              <Star className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {metrics.totalVip}
              </p>
              <p className="text-sm text-gray-400">Clientes VIP</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/20 p-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                $
                {metrics.avgSpend.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-sm text-gray-400">Gasto Promedio</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/20 p-2">
              <CreditCard className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                ${metrics.totalDebt.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400">Deuda Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, telÃ©fono o email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-900/50 py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <select
          value={filterSegment}
          onChange={e => setFilterSegment(e.target.value)}
          className="rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-2.5 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">Todos los segmentos</option>
          <option value="new">Nuevos</option>
          <option value="frequent">Frecuentes</option>
          <option value="vip">VIP</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* Lista de clientes */}
      <div className="overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/50 shadow-lg backdrop-blur-sm">
        <div className="w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Segmento
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                  Total Gastado
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                  Puntos
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                  Deuda
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredCustomers.map(customer => {
                const segmentKey = getSegmentKey(customer.segment) || "new";
                const segInfo = segmentConfig[segmentKey] || segmentConfig.new;
                return (
                  <tr key={customer._id} className="hover:bg-gray-900/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700">
                          <span className="font-medium text-gray-300">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {customer.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {customer.ordersCount || 0} compras
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-gray-300">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-1 text-gray-300">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${segInfo.color}`}
                      >
                        {segInfo.icon}
                        {segInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${(customer.totalSpend || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Award className="h-4 w-4 text-yellow-500" />
                        <span className="text-gray-900 dark:text-white">
                          {customer.points || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {customer.totalDebt > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" />$
                          {customer.totalDebt.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-green-600">$0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewDetail(customer)}
                          className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(customer)}
                          className="rounded p-1.5 text-gray-500 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {!isEmployee && (
                          <button
                            onClick={() => handleDelete(customer._id)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm || filterSegment !== "all"
                ? "No se encontraron clientes"
                : "AÃºn no hay clientes registrados"}
            </p>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    TelÃ©fono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  DirecciÃ³n
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCustomer(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingCustomer ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Detalle de Cliente
              </h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedCustomer.name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      segmentConfig[
                        getSegmentKey(selectedCustomer.segment) || "new"
                      ]?.color
                    }`}
                  >
                    {
                      segmentConfig[
                        getSegmentKey(selectedCustomer.segment) || "new"
                      ]?.icon
                    }
                    {
                      segmentConfig[
                        getSegmentKey(selectedCustomer.segment) || "new"
                      ]?.label
                    }
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Gastado
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ${(selectedCustomer.totalSpend || 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Puntos
                  </p>
                  <p className="text-xl font-bold text-yellow-600">
                    {selectedCustomer.points || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Compras
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedCustomer.ordersCount || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Deuda
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      selectedCustomer.totalDebt > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    ${(selectedCustomer.totalDebt || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-200 pt-4 text-sm dark:border-gray-700">
                {selectedCustomer.phone && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Phone className="h-4 w-4" />
                    {selectedCustomer.phone}
                  </div>
                )}
                {selectedCustomer.email && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Mail className="h-4 w-4" />
                    {selectedCustomer.email}
                  </div>
                )}
                {selectedCustomer.lastPurchaseAt && (
                  <p className="text-gray-500 dark:text-gray-400">
                    Ãšltima compra:{" "}
                    {new Date(
                      selectedCustomer.lastPurchaseAt
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Tarjeta de puntos del cliente */}
              <CustomerPointsCard
                customerId={selectedCustomer._id}
                customerName={selectedCustomer.name}
              />

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

