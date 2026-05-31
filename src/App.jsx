import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewDelivery from './pages/NewDelivery'
import Monthly from './pages/Monthly'
import Settings from './pages/Settings'
import Layout from './components/Layout'
import ClientPortal from './pages/ClientPortal'

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data || null))
  }, [session])

  if (session === undefined || (session && profile === undefined)) return <Spinner />
  if (!session) return <Login />

  // Portail client (conciergerie)
  if (profile?.role === 'client') {
    return <ClientPortal clientId={profile.client_id} />
  }

  // App admin (vous)
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="livraison" element={<NewDelivery />} />
          <Route path="mensuel" element={<Monthly />} />
          <Route path="parametres" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
