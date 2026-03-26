import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/fichas" element={<Fichas />} />
              <Route path="/fichas/new" element={<FichaForm />} />
              <Route path="/fichas/:id" element={<FichaDetail />} />
              <Route path="/fichas/:id/edit" element={<FichaForm />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/resumo" element={<Resumo />} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>
          </Route>

          {/* Redirects - old routes to new */}
          <Route path="/dashboard" element={<Navigate to="/fichas" replace />} />
          <Route path="/surgeries" element={<Navigate to="/fichas" replace />} />
          <Route path="/surgeries/new" element={<Navigate to="/fichas/new" replace />} />
          <Route path="/surgeries/:id" element={<Navigate to="/fichas" replace />} />
          <Route path="/" element={<Navigate to="/fichas" replace />} />
          <Route path="*" element={<Navigate to="/fichas" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
