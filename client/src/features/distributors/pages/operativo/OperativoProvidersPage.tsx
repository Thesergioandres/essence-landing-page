import ProvidersPage from "../../../settings/pages/ProvidersPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoProvidersPage() {
  const { canViewProviders } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Proveedores"
      description="Gestión operativa de proveedores del negocio dentro del entorno de distribuidor."
      allow={canViewProviders}
    >
      <ProvidersPage />
    </OperativoModuleShell>
  );
}
