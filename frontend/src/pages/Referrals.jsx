import { useState, useEffect, useCallback } from 'react'
import { Plus, Copy, CheckCheck, Users, Link2, Calendar, Hash } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Referrals() {
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ expiry_days: 30, max_uses: 5 })
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/referrals')
      setReferrals(res.data?.referrals || res.data || [])
    } catch {
      setError('Erro ao carregar indicações.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/referrals', {
        expires_in_days: Number(form.expiry_days),
        max_uses: Number(form.max_uses),
      })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao criar indicação.')
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (code) => {
    const link = `${window.location.origin}/register?ref=${code}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const isExpired = (r) => new Date(r.expires_at) < new Date()
  const isFull = (r) => r.uses_count >= r.max_uses

  const statusBadge = (r) => {
    if (!r.is_active || isExpired(r) || isFull(r)) {
      return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Inativo</span>
    }
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Ativo</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Indicações</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie seus links de indicação</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={18} />
          Novo Link
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-teal-600" />
            Criar novo link de indicação
          </h3>
          <form onSubmit={create} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Calendar size={13} />Validade (dias)
              </label>
              <input type="number" min="1" max="365" value={form.expiry_days}
                onChange={(e) => setForm({ ...form, expiry_days: e.target.value })}
                className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Hash size={13} />Máx. de usos
              </label>
              <input type="number" min="1" max="100" value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" disabled={creating}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg">
                {creating ? 'Gerando...' : 'Gerar Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16"><LoadingSpinner size="lg" className="mx-auto" /></div>
        ) : referrals.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Nenhum link de indicação criado</p>
            <p className="text-slate-400 text-sm mt-1">Crie links para convidar outros profissionais</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Criado em</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Expira em</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Usos</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Link</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Copiar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">{r.code}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(r.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className={`px-4 py-3 ${isExpired(r) ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                      {new Date(r.expires_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${isFull(r) ? 'text-red-600' : 'text-slate-700'}`}>
                        {r.uses_count}/{r.max_uses}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadge(r)}</td>
                    <td className="px-4 py-3 text-teal-600 text-xs font-mono truncate max-w-xs">
                      {`${window.location.origin}/register?ref=${r.code}`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => copyLink(r.code)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        title="Copiar link"
                      >
                        {copied === r.code ? <CheckCheck size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
