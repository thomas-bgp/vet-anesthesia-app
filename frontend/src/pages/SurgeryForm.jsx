import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

const SPECIES = ['Canino', 'Felino', 'Equino', 'Bovino', 'Suíno', 'Silvestre', 'Outro']

const SEX_OPTIONS = ['Macho', 'Fêmea', 'Macho castrado', 'Fêmea castrada']

const ASA_OPTIONS = ['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V']

const STATUSES = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
]

const EMPTY = {
  patient_name: '',
  patient_species: 'Canino',
  patient_breed: '',
  patient_weight: '',
  patient_age: '',
  patient_sex: '',
  owner_name: '',
  owner_phone: '',
  procedure_name: '',
  asa_classification: '',
  fasting_solid_hours: '',
  fasting_liquid_hours: '',
  start_time: '',
  pre_anesthesia: '',
  induction: '',
  maintenance: '',
  anesthesia_protocol: '',
  clinic_name: '',
  surgeon_name: '',
  revenue: '',
  status: 'scheduled',
}

const inputClass =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

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
          patient_species: s.patient_species || 'Canino',
          patient_breed: s.patient_breed || '',
          patient_weight: s.patient_weight ?? '',
          patient_age: s.patient_age || '',
          patient_sex: s.patient_sex || '',
          owner_name: s.owner_name || '',
          owner_phone: s.owner_phone || '',
          procedure_name: s.procedure_name || '',
          asa_classification: s.asa_classification || '',
          fasting_solid_hours: s.fasting_solid_hours ?? '',
          fasting_liquid_hours: s.fasting_liquid_hours ?? '',
          start_time: s.start_time ? s.start_time.slice(0, 16) : '',
          pre_anesthesia: s.pre_anesthesia || '',
          induction: s.induction || '',
          maintenance: s.maintenance || '',
          anesthesia_protocol: s.anesthesia_protocol || '',
          clinic_name: s.clinic_name || '',
          surgeon_name: s.surgeon_name || '',
          revenue: s.revenue ?? '',
          status: s.status || 'scheduled',
        })
      })
      .catch(() => setError('Erro ao carregar cirurgia.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.patient_name || !form.procedure_name || !form.start_time) {
      setError('Preencha os campos obrigatórios: paciente, procedimento e data/hora.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        patient_weight: form.patient_weight !== '' ? Number(form.patient_weight) : null,
        fasting_solid_hours: form.fasting_solid_hours !== '' ? Number(form.fasting_solid_hours) : null,
        fasting_liquid_hours: form.fasting_liquid_hours !== '' ? Number(form.fasting_liquid_hours) : null,
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
                className={inputClass} placeholder="Rex" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Espécie</label>
              <select name="patient_species" value={form.patient_species} onChange={handle} className={inputClass}>
                {SPECIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Raça</label>
              <input name="patient_breed" value={form.patient_breed} onChange={handle}
                className={inputClass} placeholder="Golden Retriever" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Idade</label>
              <input name="patient_age" value={form.patient_age} onChange={handle}
                className={inputClass} placeholder="3 anos" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sexo</label>
              <select name="patient_sex" value={form.patient_sex} onChange={handle} className={inputClass}>
                <option value="">Selecione</option>
                {SEX_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Peso (kg)</label>
              <input type="number" step="0.1" min="0" inputMode="decimal"
                name="patient_weight" value={form.patient_weight} onChange={handle}
                className={inputClass} placeholder="15.5" />
            </div>
          </div>
        </div>

        {/* Owner */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-700 mb-4">Dados do Tutor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do tutor</label>
              <input name="owner_name" value={form.owner_name} onChange={handle}
                className={inputClass} placeholder="João Silva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input name="owner_phone" value={form.owner_phone} onChange={handle}
                className={inputClass} placeholder="(11) 99999-9999" />
            </div>
          </div>
        </div>

        {/* Surgery Info */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-700 mb-4">Dados da Cirurgia</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Procedimento *</label>
              <input name="procedure_name" value={form.procedure_name} onChange={handle}
                className={inputClass} placeholder="Ovariohisterectomia eletiva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data e hora *</label>
              <input type="datetime-local" name="start_time" value={form.start_time} onChange={handle}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Classificação ASA</label>
              <select name="asa_classification" value={form.asa_classification} onChange={handle} className={inputClass}>
                <option value="">Selecione</option>
                {ASA_OPTIONS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jejum sólido (horas)</label>
              <input type="number" min="0" inputMode="decimal"
                name="fasting_solid_hours" value={form.fasting_solid_hours} onChange={handle}
                className={inputClass} placeholder="8" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jejum líquido (horas)</label>
              <input type="number" min="0" inputMode="decimal"
                name="fasting_liquid_hours" value={form.fasting_liquid_hours} onChange={handle}
                className={inputClass} placeholder="4" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clínica</label>
              <input name="clinic_name" value={form.clinic_name} onChange={handle}
                className={inputClass} placeholder="Clínica Veterinária Exemplo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cirurgião</label>
              <input name="surgeon_name" value={form.surgeon_name} onChange={handle}
                className={inputClass} placeholder="Dr. Ana Lima" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Honorários (R$)</label>
              <input type="number" step="0.01" min="0" inputMode="decimal"
                name="revenue" value={form.revenue} onChange={handle}
                className={inputClass} placeholder="350.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select name="status" value={form.status} onChange={handle} className={inputClass}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
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
                className={inputClass} placeholder="Ex: TIVA com propofol" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MPA</label>
                <textarea name="pre_anesthesia" value={form.pre_anesthesia} onChange={handle} rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Medicação pré-anestésica" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Indução</label>
                <textarea name="induction" value={form.induction} onChange={handle} rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Agentes de indução" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Manutenção</label>
                <textarea name="maintenance" value={form.maintenance} onChange={handle} rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Agentes de manutenção" />
              </div>
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
            {saving
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <><Save size={16} />Salvar Cirurgia</>
            }
          </button>
        </div>

      </form>
    </div>
  )
}
