'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  createLeaveTypeAction, updateLeaveTypeAction,
  deactivateLeaveTypeAction, reactivateLeaveTypeAction,
} from '@/app/actions/admin'

export function LeaveTypeForm({ mode, leaveType, activeRequestCount = 0 }) {
  const router = useRouter()
  const { slug } = useParams()

  const [name, setName] = useState(leaveType?.name ?? '')
  const [code, setCode] = useState(leaveType?.code ?? '')
  const [color, setColor] = useState(leaveType?.color ?? '#6B7280')
  const [paid, setPaid] = useState(leaveType?.paid ?? true)
  const [entitlement, setEntitlement] = useState(
    leaveType ? String(leaveType.annual_entitlement_days) : '0'
  )
  const [prorateOnJoin, setProrateOnJoin] = useState(leaveType?.prorate_on_join ?? true)
  const [requiresApproval, setRequiresApproval] = useState(leaveType?.requires_approval ?? true)
  const [allowHalfDay, setAllowHalfDay] = useState(leaveType?.allow_half_day ?? false)
  const [allowCarryForward, setAllowCarryForward] = useState(leaveType?.allow_carry_forward ?? false)
  const [carryForwardMaxDays, setCarryForwardMaxDays] = useState(
    leaveType?.carry_forward_max_days != null ? String(leaveType.carry_forward_max_days) : ''
  )
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(leaveType?.allow_negative_balance ?? false)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors([])
    try {
      const data = {
        name, code, color, paid,
        annual_entitlement_days: Number(entitlement),
        prorate_on_join: prorateOnJoin,
        requires_approval: requiresApproval,
        allow_half_day: allowHalfDay,
        allow_carry_forward: allowCarryForward,
        carry_forward_max_days: allowCarryForward && carryForwardMaxDays !== '' ? Number(carryForwardMaxDays) : null,
        allow_negative_balance: allowNegativeBalance,
      }
      const result = mode === 'create'
        ? await createLeaveTypeAction(data)
        : await updateLeaveTypeAction(leaveType.id, data)
      if (!result.ok) { setErrors(result.errors); return }
      router.push(`/${slug}/admin/leave-types`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    setSaving(true)
    setErrors([])
    try {
      const result = await deactivateLeaveTypeAction(leaveType.id)
      if (!result.ok) { setErrors(result.errors); return }
      router.push(`/${slug}/admin/leave-types`)
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivate() {
    setSaving(true)
    setErrors([])
    try {
      const result = await reactivateLeaveTypeAction(leaveType.id)
      if (!result.ok) { setErrors(result.errors); return }
      router.push(`/${slug}/admin/leave-types`)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
        <input
          type="text"
          required
          readOnly={mode === 'edit'}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          className={`${inputClass} font-mono${mode === 'edit' ? ' bg-gray-50 text-gray-500' : ''}`}
        />
        {mode === 'edit' && (
          <p className="text-xs text-gray-500 mt-1">Code cannot be changed after creation.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded border"
          />
          <span className="text-sm font-mono text-gray-600">{color}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="paid" checked={paid} onChange={e => setPaid(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="paid" className="text-sm font-medium text-gray-700">Paid leave</label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Entitlement (days/year)</label>
        <input type="number" required min="0" step="0.5" value={entitlement} onChange={e => setEntitlement(e.target.value)} className={inputClass} />
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="prorate" checked={prorateOnJoin} onChange={e => setProrateOnJoin(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="prorate" className="text-sm font-medium text-gray-700">Prorate entitlement on join</label>
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="approval" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="approval" className="text-sm font-medium text-gray-700">Requires manager approval</label>
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="halfday" checked={allowHalfDay} onChange={e => setAllowHalfDay(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="halfday" className="text-sm font-medium text-gray-700">Allow half-day requests</label>
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="carryforward" checked={allowCarryForward} onChange={e => setAllowCarryForward(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="carryforward" className="text-sm font-medium text-gray-700">Allow carry forward</label>
      </div>

      {allowCarryForward && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max carry forward days</label>
          <input type="number" required min="0" value={carryForwardMaxDays} onChange={e => setCarryForwardMaxDays(e.target.value)} className={inputClass} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <input type="checkbox" id="negative" checked={allowNegativeBalance} onChange={e => setAllowNegativeBalance(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="negative" className="text-sm font-medium text-gray-700">Allow negative balance</label>
      </div>

      {mode === 'edit' && activeRequestCount > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          This leave type has {activeRequestCount} active request{activeRequestCount !== 1 ? 's' : ''}. Deactivating it will not affect existing requests.
        </p>
      )}

      {errors.length > 0 && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {errors.map((e, i) => <p key={i}>{e.message}</p>)}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {mode === 'edit' && (
          leaveType.active ? (
            <Button type="button" variant="outline" onClick={handleDeactivate} disabled={saving}>
              Deactivate
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={handleReactivate} disabled={saving}>
              Reactivate
            </Button>
          )
        )}
      </div>
    </form>
  )
}
