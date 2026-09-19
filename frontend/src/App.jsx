import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { CaseProvider } from './CaseContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import DataImport from './pages/DataImport'
import Blockchain from "./pages/Blockchain";

const NetworkExplorer = lazy(() => import('./pages/NetworkExplorer'))
const EntityProfile = lazy(() => import('./pages/EntityProfile'))

function PageLoading() {
  return <div className="p-6 text-sm text-[var(--text-dim)]">Loading page...</div>
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <CaseProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="network" element={<Suspense fallback={<PageLoading />}><NetworkExplorer /></Suspense>} />
              <Route path="entities/:id" element={<Suspense fallback={<PageLoading />}><EntityProfile /></Suspense>} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="cases" element={<Cases />} />
              <Route path="cases/:id" element={<CaseDetail />} />
              <Route path="import" element={<DataImport />} />
              <Route path="/blockchain" element={<Blockchain />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CaseProvider>
    </AuthProvider>
  )
}
