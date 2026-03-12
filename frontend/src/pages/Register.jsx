import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PawPrint, Eye, EyeOff, UserPlus, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: searchParams.get('ref') || '',
  })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refStatus, setRefStatus] = useState(null) // null | 'valid' | 'invalid' | 'checking'

  // Validate referral code when it changes
  useEffect(() => {
    const code = form.referralCode.trim()
    if (!code) { setRefStatus(null); return }
    setRefStatus('checking')
    const timer = setTimeout(async () => {
      try {
        await api.get(`/referrals/validate/${code}`)
        setRefStatus('valid')
      } catch {
        setRefStatus('invalid')
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [form.referralCode])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.name || !form.email || !form.password || !form.confirmPassword || !form.referralCode) {
      setError('Preencha todos os campos.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (form.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (refStatus !== 'valid') {
      setError('Código de indicação inválido ou não verificado.')
      return
    }

    setLoading(true)
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        referralCode: form.referralCode.trim(),
      })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao cadastrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-teal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-teal-600 p-4 rounded-2xl mb-4 shadow-lg">
            <PawPrint size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">VetAnestesia</h1>
          <p className="text-teal-200 mt-1">Criar nova conta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Cadastro</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handle}
                placeholder="Dr. João Silva"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handle}
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handle}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar senha</label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handle}
                placeholder="Repita a senha"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de indicação</label>
              <div className="relative">
                <input
                  type="text"
                  name="referralCode"
                  value={form.referralCode}
                  onChange={handle}
                  placeholder="Ex: ABC123"
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase
                    ${refStatus === 'valid' ? 'border-green-400 bg-green-50' : ''}
                    ${refStatus === 'invalid' ? 'border-red-400 bg-red-50' : ''}
                    ${!refStatus ? 'border-slate-300' : ''}
                  `}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {refStatus === 'checking' && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                  )}
                  {refStatus === 'valid' && <CheckCircle size={18} className="text-green-500" />}
                  {refStatus === 'invalid' && <XCircle size={18} className="text-red-500" />}
                </div>
              </div>
              {refStatus === 'valid' && <p className="text-xs text-green-600 mt-1">Código válido!</p>}
              {refStatus === 'invalid' && <p className="text-xs text-red-500 mt-1">Código inválido ou expirado.</p>}
            </div>

            <button
              type="submit"
              disabled={loading || refStatus !== 'valid'}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold py-2.5 px-4 rounded-lg transition mt-2"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <UserPlus size={18} />
                  Cadastrar
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Já tem conta?{' '}
            <Link to="/login" className="text-teal-600 hover:text-teal-700 font-medium">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
