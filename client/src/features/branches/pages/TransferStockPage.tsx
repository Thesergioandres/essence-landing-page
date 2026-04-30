import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "../../../shared/components/ui";
import type { User } from "../../auth/types/auth.types";
import type { Branch } from "../../business/types/business.types";
import { employeeService } from "../../employees/services";
import { stockService } from "../../inventory/services/inventory.service";
import type { EmployeeStock } from "../../inventory/types/product.types";
import { useSession } from "../../../hooks/useSession";
import { authService } from "../../auth/services";

const sanitizeIdString = (raw: string): string => {
  const trimmed = String(raw || "").trim();
  if (
    !trimmed ||
    trimmed === "[object Object]" ||
    trimmed === "undefined" ||
    trimmed === "null"
  ) {
    return "";
  }

  // Handle MongoDB ObjectId hex strings
  const objectIdMatch = trimmed.match(/[a-fA-F0-9]{24}/);
  if (objectIdMatch) {
    return objectIdMatch[0].toLowerCase();
  }

  return trimmed;
};

const resolveEntityId = (value: unknown): string => {
  if (!value) return "";
  
  if (typeof value === "string") {
    return sanitizeIdString(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "object") {
    const candidate = value as {
      _id?: unknown;
      id?: unknown;
      $oid?: unknown;
      oid?: unknown;
      toHexString?: () => string;
      toString?: () => string;
    };

    // Try common ID fields
    const directId = 
      resolveEntityId(candidate._id) || 
      resolveEntityId(candidate.id) || 
      resolveEntityId(candidate.$oid) || 
      resolveEntityId(candidate.oid);
      
    if (directId) return directId;

    if (typeof candidate.toHexString === "function") {
      const hex = sanitizeIdString(candidate.toHexString());
      if (hex) return hex;
    }

    if (typeof candidate.toString === "function") {
      const s = candidate.toString();
      if (s && s !== "[object Object]") {
        return sanitizeIdString(s);
      }
    }
    
    // If it's a string representation of an ID but hidden in an object
    // (some serializers do this)
    try {
      const serialized = JSON.stringify(value);
      const match = serialized.match(/[a-fA-F0-9]{24}/);
      if (match) return match[0].toLowerCase();
    } catch {
      // ignore
    }
  }

  return "";
};

const resolveStockProductId = (stock: EmployeeStock): string => {
  return resolveEntityId(stock.product);
};

export default function TransferStock() {
  const { user: sessionUser, loading: sessionLoading } = useSession();
  const [employees, setEmployees] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [myStock, setMyStock] = useState<EmployeeStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [transferType, setTransferType] = useState<"employee" | "branch">(
    "employee"
  );
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Try to get user ID from session context, then fallback to direct service call (which checks localStorage)
      const currentUser = sessionUser || authService.getCurrentUser();
      const currentUserId = resolveEntityId(currentUser);

      // Verificar que tengamos un ID de usuario válido
      if (!currentUserId) {
        if (sessionLoading) return; // Wait for session if it's still loading
        
        setMessage({
          type: "error",
          text: "No se encontró información del usuario. Por favor, inicia sesión nuevamente.",
        });
        setLoading(false);
        return;
      }

      console.log("🚀 [TransferStock] Loading data for user:", currentUserId);

      const [employeesData, stockData, allowedBranchesData] = await Promise.all([
        employeeService.getAll({ active: true }).catch(err => {
          console.error("Error fetching employees:", err);
          return { data: [], pagination: {} };
        }),
        stockService.getEmployeeStock(currentUserId).catch(err => {
          console.error("Error fetching employee stock:", err);
          return [];
        }),
        stockService.getMyAllowedBranches().catch(err => {
          console.error("Error fetching allowed branches:", err);
          return { branches: [] };
        }),
      ]);

      // Handle employees data format
      const allEmployees = Array.isArray(employeesData)
        ? employeesData
        : (employeesData as any)?.data || [];

      const filteredEmployees = allEmployees.filter((d: User) => {
        const employeeId = resolveEntityId(d);
        return Boolean(employeeId && employeeId !== currentUserId && d.active);
      });

      console.log("📊 [TransferStock] Data loaded:", {
        employeesCount: filteredEmployees.length,
        stockItemsCount: stockData.length,
        branchesCount: (allowedBranchesData?.branches || []).length
      });

      setEmployees(filteredEmployees);
      setBranches(allowedBranchesData?.branches || []);
      setMyStock(stockData || []);
      setMessage(null);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setMessage({ type: "error", text: "Error al cargar los datos" });
    } finally {
      setLoading(false);
    }
  }, [sessionUser, sessionLoading]);

  useEffect(() => {
    if (!sessionLoading) {
      loadData();
    }
  }, [loadData, sessionLoading]);

  const getAvailableStock = () => {
    if (!selectedProduct) return 0;
    const stock = myStock.find(s => {
      const productId = resolveStockProductId(s);
      return productId === selectedProduct;
    });
    return stock?.quantity || 0;
  };

  const handleTransfer = async () => {
    try {
      setSubmitting(true);
      setMessage(null);

      let result;

      if (transferType === "employee") {
        result = await stockService.transferStock({
          toEmployeeId: selectedEmployee,
          productId: selectedProduct,
          quantity,
        });
      } else {
        result = await stockService.transferStockToBranch({
          toBranchId: selectedBranch,
          productId: selectedProduct,
          quantity,
        });
      }

      setMessage({
        type: "success",
        text: result.message || "Transferencia realizada exitosamente",
      });

      setSelectedEmployee("");
      setSelectedBranch("");
      setSelectedProduct("");
      setQuantity(1);
      setShowConfirmation(false);

      await loadData();
    } catch (error: any) {
      console.error("Error en transferencia:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message || "Error al realizar la transferencia",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (transferType === "employee" && !selectedEmployee) {
      setMessage({ type: "error", text: "Selecciona un empleado" });
      return;
    }
    
    if (transferType === "branch" && !selectedBranch) {
      setMessage({ type: "error", text: "Selecciona una sede" });
      return;
    }

    if (!selectedProduct || quantity <= 0) {
      setMessage({ type: "error", text: "Completa todos los campos correctamente" });
      return;
    }

    const availableStock = getAvailableStock();
    if (quantity > availableStock) {
      setMessage({ type: "error", text: `Stock insuficiente. Disponible: ${availableStock}` });
      return;
    }

    setShowConfirmation(true);
  };

  const getDestinationName = () => {
    if (transferType === "employee") {
      return employees.find(d => resolveEntityId(d) === selectedEmployee)?.name || "";
    } else {
      return branches.find(b => resolveEntityId(b) === selectedBranch)?.name || "";
    }
  };

  const getProductName = () => {
    const stock = myStock.find(s => resolveStockProductId(s) === selectedProduct);
    if (!stock) return "";
    return typeof stock.product === "object" ? stock.product.name : "Producto";
  };

  if (loading || sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner
          size="lg"
          message="Cargando datos de transferencia..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Transferir Inventario</h1>
        <p className="mt-2 text-gray-300">
          Transfiere productos de tu inventario a otro empleado o a una sede
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === "success"
              ? "border border-green-500/30 bg-green-500/10 text-green-300"
              : "border border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          <p className="flex items-center gap-2">
            {message.type === "success" ? "✓" : "✕"} {message.text}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de transferencia */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Tipo de Transferencia *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setTransferType("employee");
                  setSelectedBranch("");
                }}
                className={`rounded-lg border px-4 py-3 text-center transition ${
                  transferType === "employee"
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-gray-700 bg-gray-900/40 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="mb-1 text-2xl">👥</div>
                <div className="font-medium">A Empleado</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferType("branch");
                  setSelectedEmployee("");
                }}
                className={`rounded-lg border px-4 py-3 text-center transition ${
                  transferType === "branch"
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-gray-700 bg-gray-900/40 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="mb-1 text-2xl">🏢</div>
                <div className="font-medium">A Sede</div>
              </button>
            </div>
          </div>

          {/* Seleccionar empleado o sede */}
          {transferType === "employee" ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Empleado Destino *
              </label>
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                required
              >
                <option value="">Selecciona un empleado</option>
                {employees.map((dist, index) => {
                  const employeeId = resolveEntityId(dist);
                  if (!employeeId) return null;

                  return (
                    <option key={`emp-${employeeId}-${index}`} value={employeeId}>
                      {dist.name} - {dist.email}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Sede Destino *
              </label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                required
              >
                <option value="">Selecciona una sede</option>
                {branches.map((branch, index) => {
                  const branchId = resolveEntityId(branch);
                  if (!branchId) return null;

                  return (
                    <option key={`branch-${branchId}-${index}`} value={branchId}>
                      {branch.name} {branch.address ? `- ${branch.address}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Seleccionar producto */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Producto *
            </label>
            <select
              value={selectedProduct}
              onChange={e => {
                setSelectedProduct(e.target.value);
                setQuantity(1);
              }}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              required
            >
              <option value="">Selecciona un producto</option>
              {myStock
                .filter(s => s.quantity > 0)
                .map((stock, index) => {
                  const productId = resolveStockProductId(stock);
                  if (!productId) return null;

                  const productName = typeof stock.product === "object" ? stock.product.name : "Producto";
                  return (
                    <option key={`prod-${productId}-${index}`} value={productId}>
                      {productName} - Disponible: {stock.quantity}
                    </option>
                  );
                })}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Cantidad *
            </label>
            <input
              type="number"
              min="1"
              max={getAvailableStock()}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              required
            />
            {selectedProduct && (
              <p className="mt-1 text-sm text-gray-400">
                Máximo disponible: {getAvailableStock()} unidades
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Procesando..." : "Transferir"}
          </button>
        </form>
      </div>

      {/* Modal de confirmación */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white">Confirmar Transferencia</h3>
            <div className="mt-4 space-y-3 text-gray-300">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span>Producto:</span>
                <span className="font-semibold text-white">{getProductName()}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span>Cantidad:</span>
                <span className="font-semibold text-white">{quantity}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span>Destino:</span>
                <span className="font-semibold text-white">{getDestinationName()}</span>
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 rounded-xl bg-gray-800 py-2.5 text-gray-300 transition hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={submitting}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mi Inventario */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-xl font-bold text-white">Mi Inventario</h2>
        {myStock.length === 0 ? (
          <p className="text-gray-400 italic text-center py-4">No tienes productos en tu inventario</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myStock.map((stock, index) => {
              const productId = resolveStockProductId(stock);
              const productName = typeof stock.product === "object" ? stock.product.name : "Producto";
              return (
                <div key={`stock-card-${productId}-${index}`} className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
                  <h4 className="font-medium text-gray-200">{productName}</h4>
                  <p className="mt-2 text-2xl font-bold text-white">{stock.quantity}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Unidades Disponibles</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
