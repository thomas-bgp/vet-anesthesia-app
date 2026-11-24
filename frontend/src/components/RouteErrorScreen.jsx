import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'

// Tradutor do navegador (Chrome) mexe no DOM e o React quebra com insertBefore/removeChild
const DOM_MUTATION_ERROR = /insertBefore|removeChild|not a child of this node/i

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')?.id ?? null
  } catch {
    return null
  }
}

function reportError(error) {
  const payload = {
    message: String(error?.message || error?.statusText || error || 'unknown'),
    stack: String(error?.stack || ''),
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: getUserId(),
    lang: document.documentElement.lang,
    translated: /translated/.test(document.documentElement.className),
  }
  fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err) => console.error('Falha ao reportar erro da tela:', err))
}

export default function RouteErrorScreen() {
  const error = useRouteError()

  useEffect(() => {
    console.error('Erro de renderização:', error)
    reportError(error)
  }, [error])

  const isTranslatorIssue = DOM_MUTATION_ERROR.test(String(error?.message || ''))

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4">
        <h1 className="text-lg font-bold text-slate-800">Algo deu errado</h1>
        <p className="text-sm text-slate-600">
          {isTranslatorIssue
            ? 'O tradutor automático do navegador atrapalhou a tela. Desative a tradução para este site e recarregue.'
            : 'A tela não carregou como deveria. Recarregue para continuar — seus rascunhos ficam salvos no aparelho.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full min-h-[44px] rounded-xl bg-teal-600 text-white font-medium active:bg-teal-700"
        >
          Recarregar
        </button>
      </div>
    </div>
  )
}
