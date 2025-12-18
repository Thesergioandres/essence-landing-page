import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { distributorService } from '../api/services';
import { Button } from '../components/Button';

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const EditDistributor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadDistributor = async () => {
      try {
        setLoadingData(true);
        if (!id) return;
        const response = await distributorService.getById(id);
        const distributor = response.distributor;
        setFormData({
          name: distributor.name,
          email: distributor.email,
          phone: distributor.phone || '',
          address: distributor.address || '',
        });
        setError('');
       
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error al cargar distribuidor');
      } finally {
        setLoadingData(false);
      }
    };

    void loadDistributor();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validación básica
    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Email inválido');
      return;
    }

    try {
      setLoading(true);
      if (!id) return;
      await distributorService.update(id, formData);
      setSuccess('Distribuidor actualizado correctamente');
      setTimeout(() => {
        navigate(`/admin/distributors/${id}`);
      }, 1500);
     
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al actualizar distribuidor');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Editar Distribuidor</h1>
        <p className="text-gray-600 mt-2">Actualiza la información del distribuidor</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Información Personal */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Información Personal</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Dirección
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Nota sobre contraseña */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> Para cambiar la contraseña del distribuidor, contacta al administrador del sistema.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Actualizando...' : 'Actualizar Distribuidor'}
          </Button>
          <Button
            type="button"
            onClick={() => navigate(`/admin/distributors/${id}`)}
            className="px-6 bg-gray-500 hover:bg-gray-600"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditDistributor;
