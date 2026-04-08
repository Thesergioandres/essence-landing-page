import BranchesPage from "../../../branches/pages/BranchesPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoBranchesPage() {
  const { canViewInventory } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Sedes"
      description="Gestión operativa de sedes para flujo de inventario y stock."
      allow={canViewInventory}
    >
      <BranchesPage hideFinancialData />
    </OperativoModuleShell>
  );
}
