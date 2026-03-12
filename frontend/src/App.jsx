import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Medicines from './pages/Medicines'
import Surgeries from './pages/Surgeries'
import SurgeryForm from './pages/SurgeryForm'
import SurgeryDetail from './pages/SurgeryDetail'
import Stock from './pages/Stock'
import Referrals from './pages/Referrals'
import Reports from './pages/Reports'

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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/medicines" element={<Medicines />} />
              <Route path="/surgeries" element={<Surgeries />} />
              <Route path="/surgeries/new" element={<SurgeryForm />} />
              <Route path="/surgeries/:id" element={<SurgeryDetail />} />
              <Route path="/surgeries/:id/edit" element={<SurgeryForm />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
