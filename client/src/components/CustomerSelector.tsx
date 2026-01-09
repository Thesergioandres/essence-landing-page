import { Check, Loader2, Plus, Search, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { customerService } from "../api/services";

interface Customer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface CustomerSelectorProps {
  value?: string;
  onChange: (customerId: string, customer?: Customer) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  allowCreate?: boolean;
  onCreateSuccess?: (customer: Customer) => void;
}

export default function CustomerSelector({
  value,
  onChange,
  placeholder = "Buscar cliente por nombre o teléfono...",
  required = false,
  disabled = false,
  className = "",
  allowCreate = true,
  onCreateSuccess,
}: CustomerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load or search customers
  const searchCustomers = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const response = await customerService.getAll({
        search: term || undefined,
        limit: 10,
      });
      setCustomers(response.customers);
    } catch (err) {
      console.error("Error buscando clientes:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && !selectedCustomer) {
        searchCustomers(searchTerm);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchCustomers, isOpen, selectedCustomer]);

  // Load selected customer on mount if value exists
  useEffect(() => {
    if (value && !selectedCustomer) {
      customerService
        .getById(value)
        .then(response => {
          setSelectedCustomer(response.customer);
        })
        .catch(() => {
          // Customer not found
        });
    }
  }, [value, selectedCustomer]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    onChange(customer._id, customer);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    setSelectedCustomer(null);
    onChange("", undefined);
    setSearchTerm("");
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");

    try {
      const response = await customerService.create({
        name: newCustomer.name,
        phone: newCustomer.phone || undefined,
        email: newCustomer.email || undefined,
      });

      const created = response.customer;
      setSelectedCustomer(created);
      onChange(created._id, created);
      onCreateSuccess?.(created);

      setShowCreateModal(false);
      setNewCustomer({ name: "", phone: "", email: "" });
      setIsOpen(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al crear el cliente";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const openCreateWithSearch = () => {
    setNewCustomer({
      name: searchTerm,
      phone: "",
      email: "",
    });
    setShowCreateModal(true);
    setIsOpen(false);
  };

  return (
    <>
      <div ref={containerRef} className={`relative ${className}`}>
        {/* Selected Customer Display */}
        {selectedCustomer ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5">
            <User className="h-4 w-4 text-purple-400" />
            <div className="flex-1">
              <span className="font-medium text-white">
                {selectedCustomer.name}
              </span>
              {selectedCustomer.phone && (
                <span className="ml-2 text-sm text-gray-400">
                  {selectedCustomer.phone}
                </span>
              )}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              required={required && !selectedCustomer}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 py-2.5 pl-9 pr-4 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        )}

        {/* Dropdown */}
        {isOpen && !selectedCustomer && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 shadow-xl">
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
              </div>
            ) : customers.length > 0 ? (
              <ul className="max-h-60 overflow-y-auto py-1">
                {customers.map(customer => (
                  <li key={customer._id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(customer)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700"
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          {customer.name}
                        </p>
                        {(customer.phone || customer.email) && (
                          <p className="text-sm text-gray-400">
                            {customer.phone || customer.email}
                          </p>
                        )}
                      </div>
                      {value === customer._id && (
                        <Check className="h-4 w-4 text-green-400" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-gray-400">
                {searchTerm
                  ? "No se encontraron clientes"
                  : "No hay clientes registrados"}
              </div>
            )}

            {/* Create New Option */}
            {allowCreate && searchTerm.length >= 2 && (
              <div className="border-t border-gray-700">
                <button
                  type="button"
                  onClick={openCreateWithSearch}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-purple-400 hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    Crear nuevo cliente{" "}
                    {searchTerm && (
                      <span className="font-semibold">"{searchTerm}"</span>
                    )}
                  </span>
                </button>
              </div>
            )}

            {allowCreate && searchTerm.length < 2 && (
              <div className="border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(true);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-purple-400 hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>Crear nuevo cliente</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Nuevo Cliente</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError("");
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={e =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  required
                  placeholder="Nombre completo"
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={e =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  placeholder="Ej: 300 123 4567"
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={e =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  placeholder="cliente@email.com"
                  className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {createError && (
                <p className="text-sm text-red-400">{createError}</p>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError("");
                  }}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newCustomer.name}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
