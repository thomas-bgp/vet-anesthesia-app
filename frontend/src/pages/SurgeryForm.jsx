import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const SPECIES = ['Canino', 'Felino', 'Equino', 'Bovino', 'Suíno', 'Silvestre', 'Outro']
const STATUSES = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
]

const EMPTY = {
  patient_name: '', owner_name: '', species: 'Canino', breed: '', weight: '',
  procedure: '', anesthesia_protocol: '', pre_anesthesia: '', induction: '',
  maintenance: '', date: '', duration_minutes: '', revenue: '', status: 'scheduled', notes: '',
}

export default function SurgeryForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    api.get(`/surgeries/${id}`)
      .then((res) => {
        const s = res.data.surgery || res.data
        setForm({
          patient_name: s.patient_name || '',
          owner_name: s.owner_name || '',
          species: s.species || 'Canino',
          breed: s.breed || '',
          weight: s.weight ?? '',
          procedure: s.procedure || '',
          anesthesia_protocol: s.anesthesia_protocol || '',
          pre_anesthesia: s.pre_anesthesia || '',
          induction: s.induction || '',
          maintenance: s.maintenance || '',
          date: s.date ? s.date.slice(0, 16) : '',
          duration_minutes: s.duration_minutes ?? '',
          revenue: s.revenue ?? '',
          status: s.status || 'scheduled',
          notes: s.notes || '',
        })
      })
      .catch(() => setError('Erro ao carregar cirurgia.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.patient_name || !form.procedure || !form.date) {
      setError('Preencha os campos obrigatórios: paciente, procedimento e data.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        weight: form.weight !== '' ? Number(form.weight) : null,
        duration_minutes: form.duration_minutes !== '' ? Number(form.duration_minutes) : null,
        revenue: form.revenue !== '' ? Number(form.revenue) : null,
      }
      if (isEdit) {
        await api.put(`/surgeries/${id}`, payload)
      } else {
        await api.post('/surgeries', payload)
      }
      navigate('/surgeries')
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao salvar cirurgia.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/surgeries')} className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Editar Cirurgia' : 'Nova Cirurgia'}</h1>
          <p className="text-slate-500 text-sm">Preencha os dados do procedimento</p>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <form onSubmit={submit} className="space-y-6">
        {/* Patient */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-700 mb-4">Dados do Paciente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do paciente *</label>
              <input name="patient_name" value={form.patient_name} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Rex" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do tutor</label>
              <input name="owner_name" value={form.owner_name} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="João Silva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Espécie</label>
              <select name="species" value={form.species} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {SPECIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Raça</label>
              <input name="breed" value={form.breed} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Golden Retriever" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
              <input type="number" step="0.1" min="0" name="weight" value={form.weight} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="15.5" />
            </div>
          </div>
        </div>

        {/* Surgery Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-700 mb-4">Dados da Cirurgia</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Procedimento *</label>
              <input name="procedure" value={form.procedure} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Ovariohisterectomia eletiva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data e hora *</label>
              <input type="datetime-local" name="date" value={form.date} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select name="status" value={form.status} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duração (minutos)</label>
              <input type="number" min="0" name="duration_minutes" value={form.duration_minutes} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="90" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Honorários (R$)</label>
              <input type="number" step="0.01" min="0" name="revenue" value={form.revenue} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="350,00" />
            </div>
          </div>
        </div>

        {/* Anesthesia */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-700 mb-4">Protocolo Anestésico</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Protocolo geral</label>
              <input name="anesthesia_protocol" value={form.anesthesia_protocol} onChange={handle}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Ex: TIVA com propofol" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MPA</label>
                <textarea name="pre_anesthesia" value={form.pre_anesthesia} onChange={handle} rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Medicação pré-anestésica" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Indução</label>
                <textarea name="induction" value={form.induction} onChange={handle} rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Agentes de indução" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Manutenção</label>
                <textarea name="maintenance" value={form.maintenance} onChange={handle} rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Agentes de manutenção" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea name="notes" value={form.notes} onChange={handle} rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                placeholder="Anotações adicionais..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/surgeries')}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-sm font-medium rounded-lg transition">
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <><Save size={16} />Salvar Cirurgia</>}
          </button>
        </div>
      </form>
    </div>
  )
}
