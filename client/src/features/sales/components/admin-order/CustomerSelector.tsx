/**
 * Customer Selector Component
 * Autocomplete search for linking sale to customer (loyalty/points)
 */

import { Search, User, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { customerService } from "../../../customers/services/customer.service";
import type { Customer } from "../../../customers/types/customer.types";

interface CustomerSelectorProps {
  customerId: string | null;
  customerName: string | null;
  onSelectCustomer: (id: string | null, name: string | null) => void;
}

export function CustomerSelector({
  customerId,
  customerName,
  onSelectCustomer,
}: CustomerSelectorProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // Load recent customers on mount
  useEffect(() => {
    const loadRecentCustomers = async () => {
      try {
        const response = await customerService.getAll({
          limit: 10,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        setRecentCustomers(response.customers || []);
      } catch (error) {
        console.error("Error loading recent customers:", error);
      }
    };
    loadRecentCustomers();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await customerService.getAll({
          search: searchTerm,
          limit: 10,
        });
        setResults(response.customers || []);
      } catch (error) {
        console.error("Error searching customers:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelect = useCallback(
    (customer: Customer) => {
      onSelectCustomer(customer._id, customer.name);
      setIsSearching(false);
      setSearchTerm("");
      setResults([]);
    },
    [onSelectCustomer]
  );

  const handleClear = useCallback(() => {
    onSelectCustomer(null, null);
    setSearchTerm("");
    setResults([]);
  }, [onSelectCustomer]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await customerService.create(newCustomerData);
      console.warn("[Essence Debug]", "Customer created response:", response);

      const { customer } = response;
      if (!customer || !customer._id) {
        throw new Error(
          "Respuesta del servidor invÃ¡lida: No se recibiÃ³ informaciÃ³n del cliente"
        );
      }

      onSelectCustomer(customer._id, customer.name);

      // Add to recent customers list
      setRecentCustomers(prev => [customer, ...prev.slice(0, 9)]);

      setShowCreateModal(false);
      setIsSearching(false);
      setSearchTerm("");
      setResults([]);
      setNewCustomerData({ name: "", phone: "", email: "" });
    } catch (err: any) {
      console.error("Error creating customer:", err);
      if (err.response?.status === 409) {
        setCreateError("Ya existe un cliente con este email o telÃ©fono.");
      } else {
        setCreateError(
          err.message || "Error al crear cliente. Intente nuevamente."
        );
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (customerId && customerName) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
          <User className="h-4 w-4" />
          Cliente
        </h4>
        <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
              <User className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-white">{customerName}</p>
              <p className="text-xs text-gray-400">Cliente vinculado</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
        <User className="h-4 w-4" />
        Cliente (Opcional)
      </h4>

      {!isSearching ? (
        <button
          type="button"
          onClick={() => setIsSearching(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600 bg-gray-800/50 py-3 text-gray-400 transition hover:border-purple-500 hover:text-purple-400"
        >
          <UserPlus className="h-5 w-5" />
          Vincular Cliente
        </button>
      ) : (
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, telÃ©fono o email..."
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 py-2.5 pl-10 pr-10 text-white placeholder-gray-500 outline-none focus:border-purple-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setIsSearching(false);
                setSearchTerm("");
                setResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results or Recent Customers */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          )}

          {!loading && searchTerm.length >= 2 && results.length > 0 && (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/80 p-1">
              <div className="px-2 py-1 text-xs font-medium text-gray-500">
                Resultados de bÃºsqueda
              </div>
              {results.map(customer => (
                <button
                  key={customer._id}
                  type="button"
                  onClick={() => handleSelect(customer)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-purple-500/20"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {customer.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {customer.phone || customer.email || "Sin contacto"}
                    </p>
                  </div>
                  {customer.points > 0 && (
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                      {customer.points} pts
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Show recent customers when no search term or search is empty */}
          {!loading && searchTerm.length < 2 && recentCustomers.length > 0 && (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/80 p-1">
              <div className="px-2 py-1 text-xs font-medium text-gray-500">
                Clientes recientes
              </div>
              {recentCustomers.map(customer => (
                <button
                  key={customer._id}
                  type="button"
                  onClick={() => handleSelect(customer)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-purple-500/20"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700">
                    <User className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {customer.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {customer.phone || customer.email || "Sin contacto"}
                    </p>
                  </div>
                  {customer.points > 0 && (
                    <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                      {customer.points} pts
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && searchTerm.length >= 2 && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 py-4 text-center">
              <p className="mb-2 text-sm text-gray-500">
                No se encontraron clientes
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewCustomerData({ ...newCustomerData, name: searchTerm });
                  setShowCreateModal(true);
                }}
                className="text-sm font-medium text-purple-400 hover:text-purple-300"
              >
                + Crear nuevo cliente "{searchTerm}"
              </button>
            </div>
          )}

          {/* Create button divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-gray-800 px-2 text-gray-500">o</span>
            </div>
          </div>

          {/* Always show create button */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 py-2.5 text-sm font-medium text-gray-300 transition hover:border-purple-500 hover:bg-gray-800 hover:text-purple-400"
          >
            <UserPlus className="h-4 w-4" />
            Crear Cliente Nuevo
          </button>
        </div>
      )}

      {/* Quick Create Modal */}
      {showCreateModal && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[300px] rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h5 className="font-medium text-white">Nuevo Cliente</h5>
            <button
              onClick={() => setShowCreateModal(false)}
              type="button"
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleCreateCustomer} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Nombre completo *"
              value={
                newCustomerData.name ||
                (searchTerm.length > 2 ? searchTerm : "")
              }
              onChange={e =>
                setNewCustomerData({ ...newCustomerData, name: e.target.value })
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
            />
            <input
              type="tel"
              placeholder="TelÃ©fono"
              value={newCustomerData.phone}
              onChange={e =>
                setNewCustomerData({
                  ...newCustomerData,
                  phone: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
            />
            <input
              type="email"
              placeholder="Email (opcional)"
              value={newCustomerData.email}
              onChange={e =>
                setNewCustomerData({
                  ...newCustomerData,
                  email: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
            />

            {createError && (
              <p className="text-xs text-red-400">{createError}</p>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="w-full rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isCreating ? "Creando..." : "Guardar y Vincular"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

