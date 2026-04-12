import InventoryEntriesPage from "../../../inventory/pages/InventoryEntriesPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoInventoryEntriesPage() {
  const { canViewInventory } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Entradas de inventario"
      description="Registro operativo de entradas y movimientos de inventario."
      allow={canViewInventory}
    >
      <InventoryEntriesPage />
    </OperativoModuleShell>
  );
}
