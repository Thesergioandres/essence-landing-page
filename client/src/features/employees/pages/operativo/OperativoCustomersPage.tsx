import CustomersPage from "../../../customers/pages/CustomersPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoCustomersPage() {
  const { canViewCustomers } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Clientes"
      description="Gestión operativa de clientes del negocio dentro del entorno de employee."
      allow={canViewCustomers}
    >
      <CustomersPage />
    </OperativoModuleShell>
  );
}
