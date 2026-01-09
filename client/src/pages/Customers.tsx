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
import api from "../api/axios";
import { authService } from "../api/services";
import CustomerPointsCard from "../components/CustomerPointsCard";

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  segment: "new" | "frequent" | "vip" | "inactive";
  points: number;
  totalSpend: number;
  totalDebt: number;
  purchaseCount: number;
  lastPurchase?: string;
  createdAt: string;
}

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
  const isDistributor = user?.role === "distribuidor";
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

  // Métricas
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    totalVip: 0,
    totalDebt: 0,
    avgSpend: 0,
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<{ customers: Customer[] }>("/customers");
      const customerList = data.customers || [];
      setCustomers(customerList);

      // Calcular métricas
      const totalVip = customerList.filter(c => c.segment === "vip").length;
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

      console.log("[UI INFO] customers_loaded", { count: customerList.length });
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
        await api.put(`/customers/${editingCustomer._id}`, formData);
        console.log("[UI INFO] customer_updated", { id: editingCustomer._id });
      } else {
        await api.post("/customers", formData);
        console.log("[UI INFO] customer_created");
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
    if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

    try {
      await api.delete(`/customers/${id}`);
      console.log("[UI INFO] customer_deleted", { id });
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
      filterSegment === "all" || c.segment === filterSegment;
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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Clientes
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gestiona tu base de clientes y CRM
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCustomer(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition hover:bg-purple-700"
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

      {/* Métricas */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.totalCustomers}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Clientes
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
              <Star className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.totalVip}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Clientes VIP
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                $
                {metrics.avgSpend.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Gasto Promedio
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
              <CreditCard className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${metrics.totalDebt.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Deuda Total
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={filterSegment}
          onChange={e => setFilterSegment(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="all">Todos los segmentos</option>
          <option value="new">Nuevos</option>
          <option value="frequent">Frecuentes</option>
          <option value="vip">VIP</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* Lista de clientes */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Contacto
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Segmento
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Gastado
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                  Puntos
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                  Deuda
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCustomers.map(customer => {
                const segInfo =
                  segmentConfig[customer.segment] || segmentConfig.new;
                return (
                  <tr
                    key={customer._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                          <span className="font-medium text-gray-600 dark:text-gray-300">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {customer.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {customer.purchaseCount || 0} compras
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
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
                        {!isDistributor && (
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
                : "Aún no hay clientes registrados"}
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
                    Teléfono
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
                  Dirección
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
                      segmentConfig[selectedCustomer.segment]?.color
                    }`}
                  >
                    {segmentConfig[selectedCustomer.segment]?.icon}
                    {segmentConfig[selectedCustomer.segment]?.label}
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
                    {selectedCustomer.purchaseCount || 0}
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
                {selectedCustomer.lastPurchase && (
                  <p className="text-gray-500 dark:text-gray-400">
                    Última compra:{" "}
                    {new Date(
                      selectedCustomer.lastPurchase
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
