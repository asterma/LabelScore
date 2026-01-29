import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/layout/Layout'
import { Loading } from './components/common/Loading'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SessionDetailPage from './pages/SessionDetailPage'
import ExportPage from './pages/ExportPage'
import ScanPage from './pages/ScanPage'
import ReviewPage from './pages/ReviewPage'

function ProtectedRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <Loading />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function PublicRoute() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <Loading />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <Layout>
              <Outlet />
            </Layout>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/session/:sessionId" element={<SessionDetailPage />} />
          <Route path="/session/:sessionId/review/:sliceId" element={<ReviewPage />} />
          <Route path="/review/:sliceId" element={<ReviewPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
