import ExpensesPage from "../../../analytics/pages/ExpensesPage";
import OperativoModuleShell from "./OperativoModuleShell";
import { useOperativoPermissions } from "./useOperativoPermissions";

export default function OperativoExpensesPage() {
  const { canViewExpenses } = useOperativoPermissions();

  return (
    <OperativoModuleShell
      title="Operativo · Gastos"
      description="Control operativo de gastos del negocio sin salir del entorno employee."
      allow={canViewExpenses}
    >
      <ExpensesPage />
    </OperativoModuleShell>
  );
}
