'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateUserAction, deactivateUserAction, reactivateUserAction } from '@/app/actions/admin'

export function UserEditForm({ user, activeUsers, pendingRequestCount }) {
  const router = useRouter()
  const { slug } = useParams()

  const [name, setName] = useState(user.name)
  const [role, setRole] = useState(user.role)
  const [managerId, setManagerId] = useState(user.manager_id ?? '')
  const [joinDate, setJoinDate] = useState(user.join_date)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors([])
    try {
      const result = await updateUserAction(user.id, {
        name,
        role,
        manager_id: role === 'employee' && managerId ? managerId : null,
        join_date: joinDate,
      })
      if (!result.ok) { setErrors(result.errors); return }
      router.push(`/${slug}/admin/users`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    setSaving(true)
    setErrors([])
    try {
      const result = await deactivateUserAction(user.id)
      if (!result.ok) { setErrors(result.errors); return }
      router.push(`/${slug}/admin/users`)
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivate() {
    setSaving(true)
    setErrors([])
    try {
      const result = await reactivateUserAction(user.id)
      if (!result.ok) { setErrors(result.errors); return }
      router.push(`/${slug}/admin/users`)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const eligibleManagers = activeUsers.filter(u => u.role === 'manager' || u.role === 'admin')

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {role === 'employee' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
          <select value={managerId} onChange={e => setManagerId(e.target.value)} className={inputClass}>
            <option value="">— None —</option>
            {eligibleManagers.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Join date</label>
        <input type="date" required value={joinDate} onChange={e => setJoinDate(e.target.value)} className={inputClass} />
      </div>

      {user.is_active && pendingRequestCount > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          This user has {pendingRequestCount} pending leave request{pendingRequestCount !== 1 ? 's' : ''}. They will remain pending until a manager reviews them.
        </p>
      )}

      {errors.length > 0 && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {errors.map((err, i) => <p key={i}>{err.message}</p>)}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {user.is_active ? (
          <Button type="button" variant="outline" onClick={handleDeactivate} disabled={saving}>
            Deactivate
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={handleReactivate} disabled={saving}>
            Reactivate
          </Button>
        )}
      </div>
    </form>
  )
}
