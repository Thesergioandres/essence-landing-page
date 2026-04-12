import SalesPage from "../../../sales/pages/SalesPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoSalesPage() {
  const { canManageSales } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Ventas del equipo"
      description="Gestión operativa de ventas con permisos del equipo en el negocio activo."
      allow={canManageSales}
    >
      <SalesPage hideAdminProfit />
    </OperativoModuleShell>
  );
}
