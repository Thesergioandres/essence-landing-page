import TransferHistoryPage from "../../../branches/pages/TransferHistoryPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoTransferHistoryPage() {
  const { canViewTransferHistory } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Historial de transferencias"
      description="Consulta operativa de transferencias entre almacén, sedes y empleados."
      allow={canViewTransferHistory}
    >
      <TransferHistoryPage />
    </OperativoModuleShell>
  );
}
