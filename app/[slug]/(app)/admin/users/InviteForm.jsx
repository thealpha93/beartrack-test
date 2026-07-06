'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendInvite } from '@/app/actions/auth'

export function InviteForm() {
  const { slug } = useParams()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('employee')
  const [errors, setErrors] = useState([])
  const [inviteToken, setInviteToken] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors([])
    setInviteToken(null)
    try {
      const result = await sendInvite(email, role)
      if (!result.ok) { setErrors(result.errors); return }
      setInviteToken(result.data.token)
      setEmail('')
      setRole('employee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {inviteToken && (
        <div className="text-sm bg-green-50 border border-green-200 rounded px-3 py-2 space-y-1">
          <p className="font-medium text-green-800">Invite created.</p>
          <p className="text-green-700 break-all font-mono">
            {typeof window !== 'undefined' ? window.location.origin : ''}/{slug}/invite/{inviteToken}
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {errors.length > 0 && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {errors.map((err, i) => <p key={i}>{err.message}</p>)}
          </div>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
    </div>
  )
}
