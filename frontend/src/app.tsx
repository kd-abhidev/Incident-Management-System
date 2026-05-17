import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { api, type HealthStatus } from './lib/api'
import { Dashboard } from './pages/Dashboard'
import { IncidentDetail } from './pages/IncidentDetail'
import './index.css'

function Sidebar({ health }: { health: HealthStatus | null }) {
  const healthy = health?.status === 'healthy'

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: 'var(--bg2)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', padding: '24px 0', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 24px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
          letterSpacing: '0.15em', color: 'var(--text3)', textTransform: 'uppercase',
          marginBottom: 4,
        }}>System</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
          IMS
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          Incident Management
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '20px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { to: '/', label: 'Live Feed', icon: '◉' },
        ].map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 'var(--radius)',
            color: isActive ? 'var(--text)' : 'var(--text2)',
            background: isActive ? 'var(--bg3)' : 'transparent',
            fontWeight: isActive ? 600 : 400,
            fontSize: 13, transition: 'all 0.15s',
          })}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Health indicator */}
      <div style={{
        margin: '0 12px', padding: '12px', borderRadius: 'var(--radius)',
        background: 'var(--bg3)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.1em' }}>
          SYSTEM HEALTH
        </div>
        {health ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {Object.entries(health.services).map(([svc, status]) => (
              <div key={svc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{svc}</span>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: status === 'up' ? 'var(--resolved)' : 'var(--p0)',
                  boxShadow: status === 'up' ? '0 0 6px var(--resolved)' : '0 0 6px var(--p0)',
                }} />
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 5, marginTop: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                Queue: {health.queue.depth} jobs
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>connecting...</div>
        )}
      </div>
    </aside>
  )
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)

  useEffect(() => {
    const fetchHealth = () => api.health().then(setHealth).catch(() => {})
    fetchHealth()
    const t = setInterval(fetchHealth, 10_000)
    return () => clearInterval(t)
  }, [])

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar health={health} />
        <main style={{ flex: 1, overflow: 'auto', animation: 'fade-in 0.2s ease' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/incident/:id" element={<IncidentDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App

