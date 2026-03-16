import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Percent,
} from 'lucide-react';

const emptyForm = {
  procedure_name: '',
  price_without_drugs: '',
  price_with_drugs: '',
  notes: '',
};

export default function PriceTable() {
  const [items, setItems] = useState([]);
  const [profitMargin, setProfitMargin] = useState(30);
  const [marginInput, setMarginInput] = useState('');
  const [isEditingMargin, setIsEditingMargin] = useState(false);
  const [marginLoading, setMarginLoading] = useState(false);
  const [marginError, setMarginError] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/price-table');
      setItems(data.items ?? []);
      setProfitMargin(data.profit_margin_percent ?? 30);
      setMarginInput(String(data.profit_margin_percent ?? 30));
    } catch (err) {
      setError('Erro ao carregar a tabela de preços. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Margin ────────────────────────────────────────────────────────────────

  const handleMarginEdit = () => {
    setMarginInput(String(profitMargin));
    setMarginError('');
    setIsEditingMargin(true);
  };

  const handleMarginCancel = () => {
    setIsEditingMargin(false);
    setMarginError('');
  };

  const handleMarginSave = async () => {
    const value = parseFloat(marginInput);
    if (isNaN(value) || value < 0 || value > 100) {
      setMarginError('Informe um valor entre 0 e 100.');
      return;
    }
    try {
      setMarginLoading(true);
      setMarginError('');
      await api.put('/price-table/margin', { profit_margin_percent: value });
      setProfitMargin(value);
      setIsEditingMargin(false);
    } catch (err) {
      setMarginError('Erro ao salvar margem. Tente novamente.');
    } finally {
      setMarginLoading(false);
    }
  };

  // ── Add / Edit modal ───────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setFormErrors({});
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      procedure_name: item.procedure_name ?? '',
      price_without_drugs: item.price_without_drugs != null ? String(item.price_without_drugs) : '',
      price_with_drugs: item.price_with_drugs != null ? String(item.price_with_drugs) : '',
      notes: item.notes ?? '',
    });
    setFormErrors({});
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.procedure_name.trim()) {
      errors.procedure_name = 'Nome do procedimento é obrigatório.';
    }
    return errors;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      procedure_name: formData.procedure_name.trim(),
      price_without_drugs: formData.price_without_drugs !== '' ? parseFloat(formData.price_without_drugs) : null,
      price_with_drugs: formData.price_with_drugs !== '' ? parseFloat(formData.price_with_drugs) : null,
      notes: formData.notes.trim() || null,
    };

    try {
      setFormLoading(true);
      setFormError('');
      if (editingItem) {
        await api.put(`/price-table/${editingItem.id}`, payload);
      } else {
        await api.post('/price-table', payload);
      }
      closeModal();
      fetchData();
    } catch (err) {
      setFormError('Erro ao salvar procedimento. Tente novamente.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete modal ──────────────────────────────────────────────────────────

  const openDeleteModal = (item) => {
    setDeleteTarget(item);
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      setDeleteError('');
      await api.delete(`/price-table/${deleteTarget.id}`);
      closeDeleteModal();
      fetchData();
    } catch (err) {
      setDeleteError('Erro ao excluir procedimento. Tente novamente.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatCurrency = (value) => {
    if (value == null || value === '') return '—';
    return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <DollarSign className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Tabela de Preços</h1>
            <p className="text-sm text-slate-500">Gerencie os preços dos procedimentos anestésicos</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Novo Procedimento
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Margin card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-5 h-5 text-teal-600" />
          <h2 className="font-semibold text-slate-700">Margem de Lucro</h2>
        </div>

        {isEditingMargin ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={marginInput}
                  onChange={(e) => { setMarginInput(e.target.value); setMarginError(''); }}
                  className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  autoFocus
                />
                <span className="text-slate-500 text-sm">%</span>
              </div>
              {marginError && <p className="text-red-500 text-xs">{marginError}</p>}
            </div>
            <button
              onClick={handleMarginSave}
              disabled={marginLoading}
              className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors min-h-[44px]"
            >
              {marginLoading ? <LoadingSpinner small /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
            <button
              onClick={handleMarginCancel}
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-800 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors min-h-[44px]"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-teal-600">{profitMargin}%</span>
            <button
              onClick={handleMarginEdit}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 border border-slate-200 hover:border-teal-300 px-3 py-2 rounded-lg transition-colors min-h-[44px]"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Editar
            </button>
          </div>
        )}
      </div>

      {/* Procedures list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Procedimentos</h2>
          <p className="text-xs text-slate-400 mt-0.5">{items.length} procedimento{items.length !== 1 ? 's' : ''} cadastrado{items.length !== 1 ? 's' : ''}</p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <DollarSign className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhum procedimento cadastrado ainda.</p>
            <button
              onClick={openAddModal}
              className="text-teal-600 hover:text-teal-700 text-sm font-medium underline underline-offset-2"
            >
              Adicionar primeiro procedimento
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Procedimento</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-600 whitespace-nowrap">Sem Fármacos (R$)</th>
                    <th className="text-right px-5 py-3 font-semibold text-slate-600 whitespace-nowrap">Com Fármacos (R$)</th>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">Observações</th>
                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-800 font-medium">{item.procedure_name}</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">{formatCurrency(item.price_without_drugs)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">{formatCurrency(item.price_with_drugs)}</td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[200px] truncate">{item.notes || '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-800 text-sm leading-snug">{item.procedure_name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <div>
                      <span className="block text-slate-400">Sem fármacos</span>
                      <span className="font-medium text-slate-700 tabular-nums">R$ {formatCurrency(item.price_without_drugs)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Com fármacos</span>
                      <span className="font-medium text-slate-700 tabular-nums">R$ {formatCurrency(item.price_with_drugs)}</span>
                    </div>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-slate-500 italic">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">
                {editingItem ? 'Editar Procedimento' : 'Novo Procedimento'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleFormSubmit} className="px-5 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                  {formError}
                </div>
              )}

              {/* Procedure name */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  Nome do Procedimento <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="procedure_name"
                  value={formData.procedure_name}
                  onChange={handleFormChange}
                  placeholder="Ex: Anestesia geral felino"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow ${
                    formErrors.procedure_name ? 'border-red-400 bg-red-50' : 'border-slate-300'
                  }`}
                />
                {formErrors.procedure_name && (
                  <p className="text-red-500 text-xs">{formErrors.procedure_name}</p>
                )}
              </div>

              {/* Price without drugs */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  Preço sem fármacos (R$)
                </label>
                <input
                  type="number"
                  name="price_without_drugs"
                  value={formData.price_without_drugs}
                  onChange={handleFormChange}
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Price with drugs */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  Preço com fármacos (R$)
                </label>
                <input
                  type="number"
                  name="price_with_drugs"
                  value={formData.price_with_drugs}
                  onChange={handleFormChange}
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  Observações
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Observações adicionais (opcional)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 font-medium px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
                >
                  {formLoading ? (
                    <LoadingSpinner small />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingItem ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Excluir Procedimento</h2>
              <button
                onClick={closeDeleteModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Tem certeza que deseja excluir o procedimento{' '}
                <span className="font-semibold text-slate-800">"{deleteTarget.procedure_name}"</span>?
                Esta ação não pode ser desfeita.
              </p>

              {deleteError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={closeDeleteModal}
                  className="flex-1 border border-slate-200 hover:border-slate-300 text-slate-600 font-medium px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
                >
                  {deleteLoading ? (
                    <LoadingSpinner small />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
