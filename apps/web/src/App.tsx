import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { auth } from '@/lib/firebase'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { NewVehiclePage } from '@/pages/NewVehiclePage'
import { VehicleDetailPage } from '@/pages/VehicleDetailPage'

const queryClient = new QueryClient()

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | 'loading'>('loading')

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u))
  }, [])

  if (user === 'loading') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#C4A265] to-transparent animate-pulse" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <DashboardPage />
              </AuthGuard>
            }
          />
          <Route
            path="/new"
            element={
              <AuthGuard>
                <NewVehiclePage />
              </AuthGuard>
            }
          />
          <Route
            path="/vehicle/:id"
            element={
              <AuthGuard>
                <VehicleDetailPage />
              </AuthGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
