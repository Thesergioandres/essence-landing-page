import PromotionsPage from "../../../settings/pages/PromotionsPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoPromotionsPage() {
  const { canViewPromotions } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Promociones"
      description="Gestión operativa de promociones del negocio dentro del entorno de empleado."
      allow={canViewPromotions}
    >
      <PromotionsPage />
    </OperativoModuleShell>
  );
}
