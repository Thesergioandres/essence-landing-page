import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "../../../shared/components/ui";
import type { User } from "../../auth/types/auth.types";
import type { Branch } from "../../business/types/business.types";
import { employeeService } from "../../employees/services";
import { stockService } from "../../inventory/services/inventory.service";
import type { EmployeeStock } from "../../inventory/types/product.types";

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

  const objectIdMatch = trimmed.match(/[a-fA-F0-9]{24}/);
  if (objectIdMatch) {
    return objectIdMatch[0].toLowerCase();
  }

  return trimmed;
};

const resolveEntityId = (value: unknown): string => {
  if (typeof value === "string") {
    return sanitizeIdString(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
    oid?: unknown;
    toHexString?: () => string;
    toString?: () => string;
  };

  const fromToHex =
    typeof candidate.toHexString === "function"
      ? sanitizeIdString(candidate.toHexString())
      : "";

  const nested =
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    resolveEntityId(candidate.oid);

  if (fromToHex) {
    return fromToHex;
  }

  if (nested) {
    return nested;
  }

  if (typeof candidate.toString === "function") {
    return sanitizeIdString(candidate.toString());
  }

  return "";
};

const resolveStockProductId = (stock: EmployeeStock): string => {
  const rawProductId =
    typeof stock.product === "string"
      ? stock.product
      : (stock.product as { _id?: unknown })?._id;

  return resolveEntityId(rawProductId);
};

export default function TransferStock() {
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
      const user = JSON.parse(localStorage.getItem("user") || "{}") as {
        _id?: unknown;
      };
      const currentUserId = resolveEntityId(user?._id);

      // Verificar que tengamos un ID de usuario válido
      if (!currentUserId) {
        setMessage({
          type: "error",
          text: "No se encontró información del usuario. Por favor, inicia sesión nuevamente.",
        });
        setLoading(false);
        return;
      }

      const [employeesData, stockData, allowedBranchesData] = await Promise.all(
        [
          employeeService.getAll({ active: true }).catch(() => []),
          stockService.getEmployeeStock(currentUserId).catch(() => []),
          stockService.getMyAllowedBranches().catch(() => ({ branches: [] })),
        ]
      );

      // Filtrar el employee actual de la lista
      const allEmployees = Array.isArray(employeesData)
        ? employeesData
        : employeesData?.data || [];

      const filteredEmployees = allEmployees.filter((d: User) => {
        const employeeId = resolveEntityId((d as { _id?: unknown })._id);
        return Boolean(employeeId && employeeId !== currentUserId && d.active);
      });

      setEmployees(filteredEmployees);
      // Solo mostrar las sedes a las que tiene acceso
      setBranches(allowedBranchesData?.branches || []);
      setMyStock(stockData || []);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setMessage({ type: "error", text: "Error al cargar los datos" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        // Transferir a otro employee
        result = await stockService.transferStock({
          toEmployeeId: selectedEmployee,
          productId: selectedProduct,
          quantity,
        });
      } else {
        // Transferir a sede
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

      // Limpiar formulario
      setTransferType("employee");
      setSelectedEmployee("");
      setSelectedBranch("");
      setSelectedProduct("");
      setQuantity(1);
      setShowConfirmation(false);

      // Recargar stock
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

    if (transferType === "employee") {
      if (!selectedEmployee) {
        setMessage({
          type: "error",
          text: "Selecciona un empleado",
        });
        return;
      }
    } else {
      if (!selectedBranch) {
        setMessage({
          type: "error",
          text: "Selecciona una sede",
        });
        return;
      }
    }

    if (!selectedProduct || quantity <= 0) {
      setMessage({
        type: "error",
        text: "Completa todos los campos correctamente",
      });
      return;
    }

    const availableStock = getAvailableStock();
    if (quantity > availableStock) {
      setMessage({
        type: "error",
        text: `Stock insuficiente. Disponible: ${availableStock}`,
      });
      return;
    }

    setShowConfirmation(true);
  };

  const getDestinationName = () => {
    if (transferType === "employee") {
      return (
        employees.find(
          d =>
            resolveEntityId((d as { _id?: unknown })._id) === selectedEmployee
        )?.name || ""
      );
    } else {
      return (
        branches.find(
          b => resolveEntityId((b as { _id?: unknown })._id) === selectedBranch
        )?.name || ""
      );
    }
  };

  const getProductName = () => {
    const stock = myStock.find(s => {
      const productId = resolveStockProductId(s);
      return productId === selectedProduct;
    });
    if (!stock) return "";
    return typeof stock.product === "string" ? "" : stock.product.name;
  };

  if (loading) {
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
          Transfiere productos de tu inventario a otro employee o a una sede
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

          {/* Seleccionar employee o sede según el tipo */}
          {transferType === "employee" ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Employee Destino *
              </label>
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                required
              >
                <option value="">Selecciona un empleaddo</option>
                {employees.map((dist, index) => {
                  const employeeId = resolveEntityId(
                    (dist as { _id?: unknown })._id
                  );
                  if (!employeeId) {
                    return null;
                  }

                  return (
                    <option
                      key={`employee-${employeeId}-${index}`}
                      value={employeeId}
                    >
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
                  const branchId = resolveEntityId(
                    (branch as { _id?: unknown })._id
                  );
                  if (!branchId) {
                    return null;
                  }

                  return (
                    <option
                      key={`branch-${branchId}-${index}`}
                      value={branchId}
                    >
                      {branch.name}
                      {branch.address ? ` - ${branch.address}` : ""}
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
              className="w-full rounded-lg border border-gray-600 bg-gray-900/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecciona un producto</option>
              {myStock
                .filter(s => s.quantity > 0)
                .map((stock, index) => {
                  const productId = resolveStockProductId(stock);
                  if (!productId) {
                    return null;
                  }

                  const productName =
                    typeof stock.product === "string"
                      ? "Producto"
                      : stock.product.name;
                  return (
                    <option
                      key={`product-${productId}-${index}`}
                      value={productId}
                    >
                      {productName} - Disponible: {stock.quantity} unidades
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
                Disponible: {getAvailableStock()} unidades
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Procesando..." : "Transferir"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de confirmación */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white">
              Confirmar Transferencia
            </h3>
            <div className="mt-4 space-y-2 text-gray-200">
              <p>
                <strong>Producto:</strong> {getProductName()}
              </p>
              <p>
                <strong>Cantidad:</strong> {quantity} unidades
              </p>
              <p>
                <strong>Destino:</strong> {getDestinationName()}
              </p>
              <p>
                <strong>Tipo:</strong>{" "}
                {transferType === "employee" ? "Empleado" : "Sede"}
              </p>
              <p className="mt-4 text-sm text-amber-300">
                ⚠️ Esta acción no se puede deshacer. El stock se restará de tu
                inventario y se agregará al inventario del{" "}
                {transferType === "employee" ? "empleado" : "sede"} seleccionado
                {transferType === "employee" ? "" : "."}.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-700 bg-transparent px-4 py-2 font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={submitting}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Transfiriendo..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de mi inventario */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-xl font-bold text-white">
          Mi Inventario Actual
        </h2>
        <div className="space-y-2">
          {myStock.length === 0 ? (
            <p className="text-gray-400">
              No tienes productos en tu inventario
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myStock.map((stock, index) => {
                const productId = resolveStockProductId(stock);
                const productName =
                  typeof stock.product === "string"
                    ? "Producto"
                    : stock.product.name;
                return (
                  <div
                    key={productId ? `stock-${productId}` : `stock-${index}`}
                    className="rounded-lg border border-gray-700 bg-gray-900/30 p-4"
                  >
                    <h3 className="font-medium text-gray-200">{productName}</h3>
                    <p className="mt-1 text-sm text-gray-300">
                      Stock:{" "}
                      <span className="font-semibold">{stock.quantity}</span>{" "}
                      unidades
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
