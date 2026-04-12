import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { employeeService } from "../../employees/services";
import { Button, LoadingSpinner } from "../../../shared/components/ui";

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const EditEmployee = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        setLoadingData(true);
        if (!id) return;
        const response = await employeeService.getById(id);
        const employee = response.employee;
        setFormData({
          name: employee.name,
          email: employee.email,
          phone: employee.phone || "",
          address: employee.address || "",
        });
        setError("");
      } catch (err: any) {
        setError(err.response?.data?.message || "Error al cargar empleado");
      } finally {
        setLoadingData(false);
      }
    };

    void loadEmployee();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validación básica
    if (!formData.name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError("Email inválido");
      return;
    }

    try {
      setLoading(true);
      if (!id) return;
      await employeeService.update(id, formData);
      setSuccess("Empleado actualizado correctamente");
      setTimeout(() => {
        navigate(`/admin/employees/${id}`);
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Error al actualizar empleado"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando empleado..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white">Editar Empleado</h1>
        <p className="mt-2 text-gray-400">
          Actualiza la información del empleado
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-green-500 bg-green-500/10 p-4 text-sm text-green-300">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-gray-700 bg-gray-800/50 p-6"
      >
        {/* Información Personal */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white">
            Información Personal
          </h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Nombre Completo *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
                required
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
                required
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Teléfono
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Dirección
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2 text-gray-100 placeholder:text-gray-500 focus:border-transparent focus:ring-2 focus:ring-purple-500/40"
              />
            </div>
          </div>
        </div>

        {/* Nota sobre contraseña */}
        <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-white">Nota:</span> Para cambiar
            la contraseña del empleado, contacta al administrador del
            sistema.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600"
          >
            {loading ? "Actualizando..." : "Actualizar Empleado"}
          </Button>
          <Button
            type="button"
            onClick={() => navigate(`/admin/employees/${id}`)}
            variant="outline"
            className="border-gray-700 bg-transparent px-6 text-gray-200 hover:bg-gray-800"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditEmployee;
