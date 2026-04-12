import AdvancedDashboardPage from "../../../analytics/pages/AdvancedDashboardPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoAnalyticsPage() {
  const { canViewAnalytics } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Analíticas"
      description="Vista operativa de analíticas y rendimiento del negocio seleccionado."
      allow={canViewAnalytics}
    >
      <AdvancedDashboardPage />
    </OperativoModuleShell>
  );
}
