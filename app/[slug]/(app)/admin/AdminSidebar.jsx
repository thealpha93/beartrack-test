'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminSidebar({ slug }) {
  const pathname = usePathname()

  const links = [
    { label: 'Leave Types', href: `/${slug}/admin/leave-types` },
    { label: 'Users', href: `/${slug}/admin/users` },
    { label: 'Holidays', href: `/${slug}/admin/holidays` },
    { label: 'Settings', href: `/${slug}/admin/settings` },
  ]

  return (
    <nav className="w-44 shrink-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Admin</p>
      <ul className="space-y-1">
        {links.map(({ label, href }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block px-3 py-2 rounded text-sm ${
                  active
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
