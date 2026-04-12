import TeamManagementPage from "../../../business/pages/TeamManagementPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoTeamPage() {
  const { canManageTeam } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Equipo y permisos"
      description="Administración operativa del equipo dentro del entorno de empleado."
      allow={canManageTeam}
    >
      <TeamManagementPage />
    </OperativoModuleShell>
  );
}
