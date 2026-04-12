import StockManagementPage from "../../../branches/pages/StockManagementPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoStockManagementPage() {
  const { canManageStock, canViewInventory } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Gestión de stock"
      description="Panel operativo para gestionar stock sin ingresar al espacio de administración."
      allow={canManageStock && canViewInventory}
    >
      <StockManagementPage />
    </OperativoModuleShell>
  );
}
