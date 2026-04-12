import { gsap } from "gsap";
import { ChevronDown, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBusiness } from "../../../context/BusinessContext";
import { useSession } from "../../../hooks/useSession";
import { Button, LoadingSpinner } from "../../../shared/components/ui";
import type { User } from "../../auth/types/auth.types";
import { businessService } from "../../business/services";

interface ModulePermissions {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  view_costs?: boolean;
  [action: string]: boolean | undefined;
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
  financial?: ModulePermissions;
  [module: string]: ModulePermissions | undefined;
}

type PermissionAction = "read" | "create" | "update" | "delete" | "view_costs";

type PermissionModule = {
  key: string;
  label: string;
  description: string;
  actions: PermissionAction[];
};

interface CommissionSettingsDraft {
  fixedCommissionOnly: boolean;
  customCommissionRate: string;
}

interface TeamMember {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    fixedCommissionOnly?: boolean;
    isCommissionFixed?: boolean;
    customCommissionRate?: number | null;
  } | null;
  role: "admin" | "employee" | "viewer";
  status: "active" | "invited" | "disabled";
  permissions?: MemberPermissions;
}

type TeamRoleFilter = "all" | "admin" | "employee" | "viewer";
type TeamStatusFilter = "all" | "active" | "invited" | "disabled";

const MODULES = [
  {
    key: "products",
    label: "Productos",
    description: "Catálogo y configuración de productos",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "inventory",
    label: "Inventario",
    description: "Stock, movimientos y ajustes",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "sales",
    label: "Ventas",
    description: "Registro y gestión comercial",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "promotions",
    label: "Promociones",
    description: "Campañas, combos y reglas de descuento",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "providers",
    label: "Proveedores",
    description: "Catálogo y mantenimiento de proveedores",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "clients",
    label: "Clientes",
    description: "CRM y segmentación",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "expenses",
    label: "Gastos",
    description: "Registro y control de egresos",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "analytics",
    label: "Analíticas",
    description: "Paneles e indicadores",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "config",
    label: "Configuración",
    description: "Equipo, parámetros y ajustes globales",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "transfers",
    label: "Transferencias",
    description: "Movimientos entre sedes y distribuidores",
    actions: ["read", "create", "update", "delete"],
  },
  {
    key: "financial",
    label: "Blindaje Financiero 🔒",
    description:
      "Control de visibilidad de costos, márgenes y proveedor asociado",
    actions: ["view_costs"],
  },
] as PermissionModule[];

const ACTION_ORDER: PermissionAction[] = [
  "read",
  "create",
  "update",
  "delete",
  "view_costs",
];

const ACTION_LABELS: Record<PermissionAction, string> = {
  read: "Ver",
  create: "Crear",
  update: "Editar",
  delete: "Eliminar",
  view_costs: "Ver costos 🔒",
};

export default function TeamManagement() {
  const { business } = useBusiness();
  const { user: currentUser } = useSession();
  const puedeGestionarComisionFija = ["admin", "super_admin", "god"].includes(
    currentUser?.role || ""
  );
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editingPermissions, setEditingPermissions] =
    useState<MemberPermissions>({});
  const [refreshing, setRefreshing] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const permissionsModalRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<TeamRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>("all");

  // Add member form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [searchingUser, setSearchingUser] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [commissionSettings, setCommissionSettings] =
    useState<CommissionSettingsDraft>({
      fixedCommissionOnly: false,
      customCommissionRate: "20",
    });

  useEffect(() => {
    if (business) {
      loadMembers();
    }
  }, [business]);

  useEffect(() => {
    if (!showPermissionsModal || !permissionsModalRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".permission-module-card",
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.06,
          ease: "power2.out",
        }
      );

      gsap.fromTo(
        ".permission-entry",
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.012,
          delay: 0.08,
          ease: "power2.out",
        }
      );
    }, permissionsModalRef);

    return () => ctx.revert();
  }, [showPermissionsModal, selectedMember?._id]);

  const loadMembers = async () => {
    if (!business) return;
    try {
      setLoading(true);
      const response = await businessService.listMembers(business._id);
      setMembers((response.members || []) as TeamMember[]);
    } catch (err) {
      console.error("Error al cargar miembros:", err);
      setError("Error al cargar el equipo");
    } finally {
      setLoading(false);
    }
  };

  const searchUser = async () => {
    if (!business || !email.trim()) return;
    try {
      setSearchingUser(true);
      setError("");
      const result = await businessService.findMemberCandidate(
        business._id,
        email
      );

      if (result.alreadyMember) {
        setFoundUser(result.user);
        setError("Este usuario ya pertenece al equipo");
        return;
      }

      const membershipBusinessId =
        typeof result.membership?.business === "string"
          ? result.membership.business
          : result.membership?.business?._id;

      const isAllowedRole =
        result.membership?.role === "admin" ||
        result.membership?.role === "employee";

      if (
        !result.membership ||
        membershipBusinessId !== business._id ||
        !isAllowedRole
      ) {
        setFoundUser(null);
        setError(
          "Solo se permiten administradores o distribuidores de esta empresa"
        );
        return;
      }

      setFoundUser(result.user);
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
      setAddingMember(true);
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
    } finally {
      setAddingMember(false);
    }
  };

  const handleRefresh = async () => {
    if (!business) return;
    try {
      setRefreshing(true);
      setError("");
      await loadMembers();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!business) return;
    if (
      !confirm("¿Estás seguro de que deseas eliminar este miembro del equipo?")
    )
      return;

    try {
      setRemovingMemberId(membershipId);
      await businessService.removeMember(business._id, membershipId);
      setSuccess("Miembro eliminado exitosamente");
      loadMembers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al eliminar miembro");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const openPermissionsModal = (member: TeamMember) => {
    setSelectedMember(member);
    setEditingPermissions((member.permissions as MemberPermissions) || {});
    if (
      puedeGestionarComisionFija &&
      member.user &&
      typeof member.user === "object"
    ) {
      const fixed = Boolean(
        member.user.isCommissionFixed || member.user.fixedCommissionOnly
      );
      setCommissionSettings({
        fixedCommissionOnly: fixed,
        customCommissionRate:
          member.user.customCommissionRate !== null &&
          member.user.customCommissionRate !== undefined
            ? String(member.user.customCommissionRate)
            : "20",
      });
    }
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

  const animatePermissionCell = (target: HTMLElement | null) => {
    if (!target) return;

    gsap.fromTo(
      target,
      {
        scale: 1,
        boxShadow: "0 0 0 rgba(148,163,184,0)",
      },
      {
        scale: 1.06,
        boxShadow:
          "0 0 0 1px rgba(226,232,240,0.4), 0 0 18px rgba(148,163,184,0.35)",
        duration: 0.18,
        repeat: 1,
        yoyo: true,
        ease: "power2.out",
      }
    );
  };

  const savePermissions = async () => {
    if (!business || !selectedMember) return;
    try {
      setSavingPermissions(true);
      gsap.fromTo(
        ".permission-save-button",
        {
          scale: 1,
          boxShadow: "0 0 0 rgba(226,232,240,0)",
        },
        {
          scale: 1.03,
          boxShadow:
            "0 0 0 1px rgba(226,232,240,0.35), 0 0 24px rgba(203,213,225,0.4)",
          duration: 0.22,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        }
      );

      if (
        puedeGestionarComisionFija &&
        commissionSettings.fixedCommissionOnly
      ) {
        const rate = Number(commissionSettings.customCommissionRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 95) {
          setError("La comisión fija debe estar entre 0% y 95%");
          return;
        }
      }

      await businessService.updateMemberPermissions(
        business._id,
        selectedMember._id,
        {
          permissions: editingPermissions as Record<string, unknown>,
          ...(puedeGestionarComisionFija
            ? {
                commissionSettings: {
                  fixedCommissionOnly: commissionSettings.fixedCommissionOnly,
                  customCommissionRate: commissionSettings.fixedCommissionOnly
                    ? Number(commissionSettings.customCommissionRate)
                    : null,
                },
              }
            : {}),
        }
      );
      setSuccess("Permisos actualizados exitosamente");
      setShowPermissionsModal(false);
      loadMembers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al actualizar permisos");
    } finally {
      setSavingPermissions(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members
      .filter(member => {
        const user = typeof member.user === "object" ? member.user : null;
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery =
          !query ||
          Boolean(user?.name?.toLowerCase().includes(query)) ||
          Boolean(user?.email?.toLowerCase().includes(query));
        const matchesRole = roleFilter === "all" || member.role === roleFilter;
        const matchesStatus =
          statusFilter === "all" || member.status === statusFilter;
        return matchesQuery && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        const aName =
          typeof a.user === "object" && a.user?.name ? a.user.name : "";
        const bName =
          typeof b.user === "object" && b.user?.name ? b.user.name : "";
        return aName.localeCompare(bName, "es", { sensitivity: "base" });
      });
  }, [members, roleFilter, searchQuery, statusFilter]);

  const activeMembersCount = useMemo(
    () => members.filter(member => member.status === "active").length,
    [members]
  );

  const distributorCount = useMemo(
    () => members.filter(member => member.role === "employee").length,
    [members]
  );

  const adminCount = useMemo(
    () => members.filter(member => member.role === "admin").length,
    [members]
  );

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
      case "employee":
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
      case "employee":
        return "Distribuidor";
      case "viewer":
        return "Observador";
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(71,85,105,0.22),rgba(2,6,23,0.96)_42%,rgba(2,6,23,0.99)_100%)] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.55)] backdrop-blur-[10px] sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestión de Equipo</h1>
          <p className="mt-1 text-sm text-gray-400">
            Administra los miembros y sus permisos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            loading={refreshing}
            disabled={loading}
          >
            Actualizar
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Agregar Miembro
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="bg-white/4 rounded-2xl border border-white/10 p-4 backdrop-blur-[10px]">
          <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
          <p className="mt-2 text-2xl font-bold text-white">{members.length}</p>
        </div>
        <div className="bg-white/4 rounded-2xl border border-white/10 p-4 backdrop-blur-[10px]">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Activos
          </p>
          <p className="mt-2 text-2xl font-bold text-green-400">
            {activeMembersCount}
          </p>
        </div>
        <div className="bg-white/4 rounded-2xl border border-white/10 p-4 backdrop-blur-[10px]">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Admins / Distribuidores
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-300">
            {adminCount} / {distributorCount}
          </p>
        </div>
      </div>

      <div className="bg-white/4 grid gap-3 rounded-2xl border border-white/10 p-4 backdrop-blur-[10px] md:grid-cols-3">
        <input
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          placeholder="Buscar por nombre o email"
          className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
        />
        <select
          value={roleFilter}
          onChange={event =>
            setRoleFilter(event.target.value as TeamRoleFilter)
          }
          className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="all">Todos los roles</option>
          <option value="admin">Administradores</option>
          <option value="employee">Distribuidores</option>
          <option value="viewer">Observadores</option>
        </select>
        <select
          value={statusFilter}
          onChange={event =>
            setStatusFilter(event.target.value as TeamStatusFilter)
          }
          className="rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="invited">Invitado</option>
          <option value="disabled">Deshabilitado</option>
        </select>
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
      <div className="bg-white/4 rounded-2xl border border-white/10 backdrop-blur-[10px]">
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
              {filteredMembers.map(member => {
                const user =
                  typeof member.user === "object" ? member.user : null;
                const isCurrentUser =
                  Boolean(currentUser?._id) && currentUser?._id === user?._id;
                const isRemoving = removingMemberId === member._id;
                const hasFixedCommission = Boolean(
                  user?.fixedCommissionOnly || user?.isCommissionFixed
                );
                return (
                  <tr key={member._id} className="border-b border-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-linear-to-br flex h-10 w-10 items-center justify-center rounded-full from-purple-500 to-blue-500">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-medium text-white">
                          {user?.name || "Usuario"}
                        </span>
                        {puedeGestionarComisionFija && hasFixedCommission && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            Comisión fija
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                            Tú
                          </span>
                        )}
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
                          disabled={isCurrentUser || isRemoving}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                          title={
                            isCurrentUser
                              ? "No puedes eliminar tu propio acceso"
                              : "Eliminar miembro"
                          }
                        >
                          {isRemoving ? (
                            <svg
                              className="h-4 w-4 animate-spin"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No hay miembros que coincidan con los filtros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="z-90 fixed inset-0 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[linear-gradient(155deg,rgba(15,23,42,0.94),rgba(2,6,23,0.97))] p-6 backdrop-blur-[10px]">
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
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          searchUser();
                        }
                      }}
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
                    <p className="text-xs text-green-400/70">
                      {foundUser.email}
                    </p>
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
                        setRole(e.target.value as "admin" | "employee")
                      }
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="admin">Administrador</option>
                      <option value="employee">Distribuidor</option>
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
                    loading={addingMember}
                    disabled={!foundUser || addingMember}
                    className="flex-1"
                  >
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Permissions Modal */}
      {showPermissionsModal &&
        selectedMember &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="z-90 fixed inset-0 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
            <div
              ref={permissionsModalRef}
              className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98)_55%,rgba(3,7,18,0.98))] p-6 backdrop-blur-[10px]"
            >
              <h2 className="mb-4 text-xl font-bold text-white">
                Configurar Permisos -{" "}
                {selectedMember.user && typeof selectedMember.user === "object"
                  ? selectedMember.user.name
                  : "Usuario"}
              </h2>

              <div className="mb-6 rounded-lg border border-purple-500/20 bg-purple-500/10 p-4">
                <p className="text-sm text-purple-300">
                  <strong>Rol base:</strong> {getRoleLabel(selectedMember.role)}
                </p>
                <p className="mt-1 text-xs text-purple-300/70">
                  Los permisos configurados aquí se combinan con los permisos
                  por defecto del rol
                </p>
              </div>

              {puedeGestionarComisionFija && (
                <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-sm font-semibold text-amber-300">
                    Comisión fija blindada (admin/super admin/god)
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Si activas este modo, se ignoran bonos de gamificación y se
                    aplica siempre la tasa fija.
                  </p>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={commissionSettings.fixedCommissionOnly}
                        onChange={e =>
                          setCommissionSettings(prev => ({
                            ...prev,
                            fixedCommissionOnly: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-white/20 bg-black/30"
                      />
                      Activar comisión fija
                    </label>

                    <div>
                      <label className="mb-1 block text-xs text-gray-300">
                        Tasa fija (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={95}
                        step="0.1"
                        disabled={!commissionSettings.fixedCommissionOnly}
                        value={commissionSettings.customCommissionRate}
                        onChange={e =>
                          setCommissionSettings(prev => ({
                            ...prev,
                            customCommissionRate: e.target.value,
                          }))
                        }
                        className="w-32 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 backdrop-blur-[10px]">
                <p className="text-sm font-medium text-cyan-200">
                  Matriz granular por módulo y acción
                </p>
                <p className="mt-1 text-xs text-cyan-100/80">
                  Marca manualmente cada permiso. El módulo financiero controla
                  si el usuario puede ver costos, márgenes y proveedor asociado.
                </p>
              </div>

              {/* Permissions Matrix - mobile accordions */}
              <div className="space-y-3 md:hidden">
                {MODULES.map(module => {
                  const orderedActions = ACTION_ORDER.filter(action =>
                    module.actions.includes(action)
                  );

                  return (
                    <details
                      key={module.key}
                      className="permission-module-card bg-white/3 group overflow-hidden rounded-2xl border border-white/10"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {module.label}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {module.description}
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                      </summary>

                      <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
                        {orderedActions.map(action => {
                          const isEnabled =
                            editingPermissions[module.key]?.[action] === true;

                          return (
                            <label
                              key={action}
                              data-permission-cell
                              className="permission-entry inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-200"
                            >
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={event => {
                                  const cell = event.currentTarget.closest(
                                    "[data-permission-cell]"
                                  ) as HTMLElement | null;
                                  animatePermissionCell(cell);
                                  togglePermission(module.key, action);
                                }}
                                className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-emerald-500 focus:ring-emerald-500/40"
                              />
                              <span>{ACTION_LABELS[action]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>

              {/* Permissions Matrix - tablet/desktop dynamic grid */}
              <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
                {MODULES.map(module => {
                  const orderedActions = ACTION_ORDER.filter(action =>
                    module.actions.includes(action)
                  );

                  return (
                    <article
                      key={module.key}
                      className="permission-module-card bg-white/3 rounded-2xl border border-white/10 p-4"
                    >
                      <p className="text-sm font-semibold text-white">
                        {module.label}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {module.description}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {orderedActions.map(action => {
                          const isEnabled =
                            editingPermissions[module.key]?.[action] === true;

                          return (
                            <label
                              key={action}
                              data-permission-cell
                              className="permission-entry inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-gray-200"
                            >
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={event => {
                                  const cell = event.currentTarget.closest(
                                    "[data-permission-cell]"
                                  ) as HTMLElement | null;
                                  animatePermissionCell(cell);
                                  togglePermission(module.key, action);
                                }}
                                className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-emerald-500 focus:ring-emerald-500/40"
                              />
                              <span>{ACTION_LABELS[action]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
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
                <Button
                  onClick={savePermissions}
                  className="permission-save-button flex-1"
                  loading={savingPermissions}
                  disabled={savingPermissions}
                >
                  Guardar Permisos
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
