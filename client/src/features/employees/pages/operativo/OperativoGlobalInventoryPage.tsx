import GlobalInventoryPage from "../../../inventory/pages/GlobalInventoryPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoGlobalInventoryPage() {
  const { canViewInventory } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Inventario global"
      description="Vista operativa del inventario global para el negocio activo."
      allow={canViewInventory}
    >
      <GlobalInventoryPage />
    </OperativoModuleShell>
  );
}
