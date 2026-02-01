import { Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useBusiness } from "../../../context/BusinessContext";
import { userService } from "../../auth/services";
import { businessService } from "../../business/services";
import { Button, LoadingSpinner } from "../../../shared/components/ui";
import type { Membership, User } from "../../../types";

interface ModulePermissions {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
}

interface MemberPermissions {
  products?: ModulePermissions;
  inventory?: ModulePermissions;
  sales?: ModulePermissions;
  promotions?: ModulePermissions;
  providers?: ModulePermissions;
  clients?: ModulePermissions;
  expenses?: ModulePermissions;
  analytics?: ModulePermissions;
  config?: ModulePermissions;
  transfers?: ModulePermissions;
}

const MODULES = [
  { key: "products", label: "Productos" },
  { key: "inventory", label: "Inventario" },
  { key: "sales", label: "Ventas" },
  { key: "promotions", label: "Promociones" },
  { key: "providers", label: "Proveedores" },
  { key: "clients", label: "Clientes" },
  { key: "expenses", label: "Gastos" },
  { key: "analytics", label: "Analíticas" },
  { key: "config", label: "Configuración" },
  { key: "transfers", label: "Transferencias" },
];

const ACTIONS = [
  { key: "read", label: "Ver" },
  { key: "create", label: "Crear" },
  { key: "update", label: "Editar" },
  { key: "delete", label: "Eliminar" },
];

export default function TeamManagement() {
  const { business } = useBusiness();
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Membership | null>(null);
  const [editingPermissions, setEditingPermissions] =
    useState<MemberPermissions>({});

  // Add member form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "distribuidor" | "viewer">(
    "distribuidor"
  );
  const [searchingUser, setSearchingUser] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (business) {
      loadMembers();
    }
  }, [business]);

  const loadMembers = async () => {
    if (!business) return;
    try {
      setLoading(true);
      const response = await businessService.listMembers(business._id);
      setMembers(response);
    } catch (err) {
      console.error("Error al cargar miembros:", err);
      setError("Error al cargar el equipo");
    } finally {
      setLoading(false);
    }
  };

  const searchUser = async () => {
    if (!email.trim()) return;
    try {
      setSearchingUser(true);
      setError("");
      const user = await userService.findByEmail(email);
      setFoundUser(user);
    } catch (err: any) {
      setError(err.response?.data?.message || "Usuario no encontrado");
      setFoundUser(null);
    } finally {
      setSearchingUser(false);
    }
  };

  const handleAddMember = async () => {
    if (!business || !foundUser) return;
    try {
      setError("");
      await businessService.addMember(business._id, {
        userId: foundUser._id,
        role,
      });
      setSuccess("Miembro agregado exitosamente");
      setShowAddModal(false);
      setEmail("");
      setFoundUser(null);
      loadMembers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al agregar miembro");
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!business) return;
    if (
      !confirm("¿Estás seguro de que deseas eliminar este miembro del equipo?")
    )
      return;

    try {
      await businessService.removeMember(business._id, membershipId);
      setSuccess("Miembro eliminado exitosamente");
      loadMembers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al eliminar miembro");
    }
  };

  const openPermissionsModal = (member: Membership) => {
    setSelectedMember(member);
    setEditingPermissions((member.permissions as MemberPermissions) || {});
    setShowPermissionsModal(true);
  };

  const togglePermission = (module: string, action: string) => {
    setEditingPermissions(prev => ({
      ...prev,
      [module]: {
        ...(prev[module as keyof MemberPermissions] || {}),
        [action]: !(prev[module as keyof MemberPermissions] as any)?.[action],
      },
    }));
  };

  const savePermissions = async () => {
    if (!business || !selectedMember) return;
    try {
      await businessService.updateMemberPermissions(
        business._id,
        selectedMember._id,
        editingPermissions as Record<string, unknown>
      );
      setSuccess("Permisos actualizados exitosamente");
      setShowPermissionsModal(false);
      loadMembers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al actualizar permisos");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500/20 text-purple-400";
      case "distribuidor":
        return "bg-blue-500/20 text-blue-400";
      case "viewer":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "distribuidor":
        return "Distribuidor";
      case "viewer":
        return "Observador";
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Equipo</h1>
          <p className="mt-1 text-sm text-gray-400">
            Administra los miembros y sus permisos
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Agregar Miembro
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg bg-red-500/10 p-4 text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-500/10 p-4 text-green-400">
          {success}
        </div>
      )}

      {/* Members List */}
      <div className="rounded-lg border border-white/10 bg-black/40">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-4 text-left text-sm font-medium text-gray-400">
                  Usuario
                </th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">
                  Email
                </th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">
                  Rol
                </th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">
                  Estado
                </th>
                <th className="p-4 text-left text-sm font-medium text-gray-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const user =
                  typeof member.user === "object" ? member.user : null;
                return (
                  <tr key={member._id} className="border-b border-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-medium text-white">
                          {user?.name || "Usuario"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {user?.email || "-"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getRoleBadgeColor(member.role)}`}
                      >
                        {getRoleLabel(member.role)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          member.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {member.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPermissionsModal(member)}
                          className="rounded-lg p-2 text-purple-400 hover:bg-purple-500/10"
                          title="Configurar permisos"
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member._id)}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                          title="Eliminar miembro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No hay miembros en el equipo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-gray-900 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">
              Agregar Miembro
            </h2>

            <div className="space-y-4">
              {/* Email search */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Email del usuario
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    placeholder="usuario@ejemplo.com"
                  />
                  <Button onClick={searchUser} disabled={searchingUser}>
                    {searchingUser ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>

              {/* Found user */}
              {foundUser && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                  <p className="text-sm font-medium text-green-400">
                    Usuario encontrado: {foundUser.name}
                  </p>
                  <p className="text-xs text-green-400/70">{foundUser.email}</p>
                </div>
              )}

              {/* Role selection */}
              {foundUser && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Rol
                  </label>
                  <select
                    value={role}
                    onChange={e =>
                      setRole(
                        e.target.value as "admin" | "distribuidor" | "viewer"
                      )
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="admin">Administrador</option>
                    <option value="distribuidor">Distribuidor</option>
                    <option value="viewer">Observador</option>
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    setEmail("");
                    setFoundUser(null);
                    setError("");
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={!foundUser}
                  className="flex-1"
                >
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-white/10 bg-gray-900 p-6">
            <h2 className="mb-4 text-xl font-bold text-white">
              Configurar Permisos -{" "}
              {typeof selectedMember.user === "object"
                ? selectedMember.user.name
                : "Usuario"}
            </h2>

            <div className="mb-6 rounded-lg border border-purple-500/20 bg-purple-500/10 p-4">
              <p className="text-sm text-purple-300">
                <strong>Rol base:</strong> {getRoleLabel(selectedMember.role)}
              </p>
              <p className="mt-1 text-xs text-purple-300/70">
                Los permisos configurados aquí se combinan con los permisos por
                defecto del rol
              </p>
            </div>

            {/* Permissions Grid */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-3 text-left text-sm font-medium text-gray-400">
                      Módulo
                    </th>
                    {ACTIONS.map(action => (
                      <th
                        key={action.key}
                        className="p-3 text-center text-sm font-medium text-gray-400"
                      >
                        {action.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(module => (
                    <tr key={module.key} className="border-b border-white/5">
                      <td className="p-3 font-medium text-white">
                        {module.label}
                      </td>
                      {ACTIONS.map(action => {
                        const isEnabled =
                          (
                            editingPermissions[
                              module.key as keyof MemberPermissions
                            ] as any
                          )?.[action.key] === true;
                        return (
                          <td key={action.key} className="p-3 text-center">
                            <button
                              onClick={() =>
                                togglePermission(module.key, action.key)
                              }
                              className={`h-8 w-8 rounded-lg transition-colors ${
                                isEnabled
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                              }`}
                            >
                              {isEnabled ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedMember(null);
                  setError("");
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={savePermissions} className="flex-1">
                Guardar Permisos
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
