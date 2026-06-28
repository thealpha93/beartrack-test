'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateTenantSettingsAction } from '@/app/actions/admin'

const TIMEZONES = [
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Europe/Dublin', 'Europe/Lisbon', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Vancouver',
  'America/Sao_Paulo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
]

export function TenantSettingsForm({ tenant }) {
  const [name, setName] = useState(tenant.name)
  const [timezone, setTimezone] = useState(tenant.timezone)
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(tenant.fiscal_year_start_month)
  const [workingWeek, setWorkingWeek] = useState(tenant.working_week ?? [1, 2, 3, 4, 5])
  const [hoursPerWorkday, setHoursPerWorkday] = useState(tenant.hours_per_workday)
  const [minHeadcountThreshold, setMinHeadcountThreshold] = useState(tenant.min_headcount_threshold)
  const [errors, setErrors] = useState([])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const fiscalYearChanged = Number(fiscalYearStartMonth) !== tenant.fiscal_year_start_month

  function toggleDay(day) {
    setWorkingWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors([])
    setSaved(false)
    try {
      const result = await updateTenantSettingsAction({
        name,
        timezone,
        fiscal_year_start_month: Number(fiscalYearStartMonth),
        working_week: workingWeek,
        hours_per_workday: Number(hoursPerWorkday),
        min_headcount_threshold: Number(minHeadcountThreshold),
      })
      if (!result.ok) { setErrors(result.errors); return }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
        <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputClass}>
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal year start</label>
        <select value={fiscalYearStartMonth} onChange={e => setFiscalYearStartMonth(Number(e.target.value))} className={inputClass}>
          {MONTHS.map((month, i) => (
            <option key={i + 1} value={i + 1}>{month}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Working week</label>
        <div className="flex gap-2">
          {DAYS.map(({ label, value }) => (
            <button
              type="button"
              key={value}
              onClick={() => toggleDay(value)}
              className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                workingWeek.includes(value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hours per workday</label>
        <input type="number" required min="1" max="24" value={hoursPerWorkday} onChange={e => setHoursPerWorkday(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Min headcount threshold</label>
        <input type="number" required min="0" value={minHeadcountThreshold} onChange={e => setMinHeadcountThreshold(e.target.value)} className={inputClass} />
        <p className="text-xs text-gray-500 mt-1">Minimum number of employees who must be present on any given day.</p>
      </div>

      {fiscalYearChanged && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Changing the fiscal year start affects how leave balances are calculated for all employees going forward. Existing approved requests are not recalculated.
        </p>
      )}

      {errors.length > 0 && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {errors.map((err, i) => <p key={i}>{err.message}</p>)}
        </div>
      )}

      {saved && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          Settings saved.
        </p>
      )}

      <Button type="submit" disabled={saving || workingWeek.length === 0}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </form>
  )
}
