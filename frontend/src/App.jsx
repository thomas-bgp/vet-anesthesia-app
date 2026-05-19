import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Fichas from './pages/Fichas'
import FichaForm from './pages/FichaForm'
import FichaDetail from './pages/FichaDetail'
import Estoque from './pages/Estoque'
import Resumo from './pages/Resumo'
import Perfil from './pages/Perfil'
import Compras from './pages/Compras'
import Financeiro from './pages/Financeiro'
import AReceber from './pages/AReceber'
import Controladoria from './pages/Controladoria'
import Validar from './pages/Validar'
import FinancasPessoais from './pages/FinancasPessoais'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/validar',
    element: <Validar />,
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/fichas', element: <Fichas /> },
          { path: '/fichas/new', element: <FichaForm /> },
          { path: '/fichas/:id', element: <FichaDetail /> },
          { path: '/fichas/:id/edit', element: <FichaForm /> },
          { path: '/rascunhos', element: <Navigate to="/fichas" replace /> },
          { path: '/estoque', element: <Estoque /> },
          { path: '/compras', element: <Compras /> },
          { path: '/a-receber', element: <AReceber /> },
          { path: '/resumo', element: <Resumo /> },
          { path: '/financeiro', element: <Financeiro /> },
          { path: '/controladoria', element: <Controladoria /> },
          { path: '/financas-pessoais', element: <FinancasPessoais /> },
          { path: '/perfil', element: <Perfil /> },
        ],
      },
    ],
  },
  { path: '/dashboard', element: <Navigate to="/fichas" replace /> },
  { path: '/surgeries', element: <Navigate to="/fichas" replace /> },
  { path: '/surgeries/new', element: <Navigate to="/fichas/new" replace /> },
  { path: '/surgeries/:id', element: <Navigate to="/fichas" replace /> },
  { path: '/', element: <Navigate to="/fichas" replace /> },
  { path: '*', element: <Navigate to="/fichas" replace /> },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
