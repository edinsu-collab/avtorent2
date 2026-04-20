'use client'

import { usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const AGENT_NAV = [
  { href: '/admin', label: 'Pregled' },
  { href: '/admin/dan', label: 'Dnevni pregled' },
  { href: '/admin/rezervacije', label: 'Rezervacije' },
  { href: '/admin/kalendar', label: 'Kalendar' },
  { href: '/admin/finansije', label: 'Finansije' },
]

const ADMIN_NAV = [
  { href: '/admin', label: 'Pregled' },
  { href: '/admin/dan', label: 'Dnevni pregled' },
  { href: '/admin/rezervacije', label: 'Rezervacije' },
  { href: '/admin/kalendar', label: 'Kalendar' },
  { href: '/admin/finansije', label: 'Finansije' },
  { href: '/admin/partneri', label: 'Partneri' },
  { href: '/admin/vozila', label: 'Vozila' },
  { href: '/admin/cijene', label: 'Cijene' },
  { href: '/admin/lokacije', label: 'Lokacije' },
  { href: '/admin/dodaci', label: 'Dodaci' },
  { href: '/admin/doplate', label: 'Doplate' },
  { href: '/admin/kuponi', label: 'Kuponi' },
  { href: '/admin/agenti', label: 'Agenti' },
  { href: '/admin/klijenti', label: 'Klijenti' },
  { href: '/admin/finansije-pregled', label: 'Finansije agenata' },
  { href: '/admin/analitika', label: 'QR analitika' },
]

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('')

  useEffect(() => {
    const name = getCookie('avtorent-agent-name')
    setAgentName(name)
    if (name) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      supabase.from('agents').select('role').eq('full_name', name).single()
        .then(({ data }) => setRole(data?.role || 'agent'))
    }
  }, [])

  if (pathname === '/admin/login') return <>{children}</>

  const navItems = role === 'admin' ? ADMIN_NAV : AGENT_NAV

  async function handleLogout() {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    document.cookie = 'avtorent-admin-token=; path=/; max-age=0'
    document.cookie = 'avtorent-agent-name=; path=/; max-age=0'
    window.location.href = '/admin/login'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ width: 210, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 16, fontWeight: 700, color: '#111' }}>
          Avto<span style={{ color: '#1D9E75' }}>Rent</span>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
            {role === 'admin' ? 'admin' : 'agent'}
          </span>
        </div>
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {navItems.map(item => {
            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            return (
              <a key={item.href} href={item.href} style={{ display: 'block', padding: '9px 16px', fontSize: 13, textDecoration: 'none', color: isActive ? '#1D9E75' : '#6b7280', fontWeight: isActive ? 600 : 400, background: isActive ? '#f0fdf8' : 'transparent', borderRight: isActive ? '2px solid #1D9E75' : '2px solid transparent' }}>
                {item.label}
              </a>
            )
          })}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid #e5e7eb' }}>
          {agentName && <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginBottom: 4 }}>{agentName}</div>}
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>
            Odjavi se
          </button>
        </div>
      </div>
      <div style={{ flex: 1, padding: 28, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
