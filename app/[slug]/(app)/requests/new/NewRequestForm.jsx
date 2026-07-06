'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { submitLeaveRequest } from '@/app/actions/leave-requests'
import { getEmployeeBalance } from '@/app/actions/balances'
import { formatDays } from '@/lib/utils/format.js'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function countWorkingDaysClient(start, end, workingWeek, holidays) {
  const holidaySet = new Set(holidays)
  let count = 0
  const current = new Date(start)
  while (current <= new Date(end)) {
    const dow = current.getDay() === 0 ? 7 : current.getDay()
    const ds = current.toISOString().slice(0, 10)
    if (workingWeek.includes(dow) && !holidaySet.has(ds)) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

const STEPS = ['Leave type', 'Dates', 'Day type', 'Note', 'Review']

export function NewRequestForm({ slug, leaveTypes, holidays, workingWeek, employeeId, existingRequests = [] }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dayType, setDayType] = useState('FULL')
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [balance, setBalance] = useState(null)
  const [workingDays, setWorkingDays] = useState(0)
  const [errors, setErrors] = useState([])
  const [warnings, setWarnings] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState(false)
  const isSubmitting = useRef(false)

  const selectedType = leaveTypes.find(lt => lt.id === leaveTypeId)

  function checkOverlap(sd, ed) {
    if (!sd || !ed) { setOverlapWarning(false); return }
    const overlaps = existingRequests.some(r => r.start_date <= ed && r.end_date >= sd)
    setOverlapWarning(overlaps)
  }

  async function fetchBalance(ltId, sd, ed) {
    if (!ltId || !sd || !ed) return
    const days = dayType === 'HALF_AM' || dayType === 'HALF_PM'
      ? 0.5
      : countWorkingDaysClient(sd, ed, workingWeek, holidays)
    setWorkingDays(days)
    const res = await getEmployeeBalance(employeeId, ltId)
    if (res.ok) setBalance(res.data)
  }

  async function handleSubmit() {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setSubmitting(true)
    setErrors([])
    try {
      const result = await submitLeaveRequest({ leaveTypeId, startDate, endDate, dayType, hours: hours || null, note })
      if (!result.ok) { setErrors(result.errors); return }
      setWarnings(result.data.warnings ?? [])
      router.push(`/${slug}/dashboard`)
    } finally {
      isSubmitting.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">New Leave Request</h1>

      {/* Step indicators */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => {
          const s = i + 1
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full ${s <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />
              <span className={`text-xs ${s === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">

          {step === 1 && (
            <div className="space-y-3">
              <p className="font-medium">Select leave type</p>
              {leaveTypes.map(lt => (
                <button
                  key={lt.id}
                  onClick={() => { setLeaveTypeId(lt.id); fetchBalance(lt.id, startDate, endDate) }}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 ${leaveTypeId === lt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: lt.color }} />
                  <span className="text-sm font-medium">{lt.name}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="font-medium">Select dates</p>
              <div>
                <label className="text-sm text-gray-600">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); fetchBalance(leaveTypeId, e.target.value, endDate); checkOverlap(e.target.value, endDate) }}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">End date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => { setEndDate(e.target.value); fetchBalance(leaveTypeId, startDate, e.target.value); checkOverlap(startDate, e.target.value) }}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm"
                />
              </div>
              {workingDays > 0 && (
                <p className="text-sm text-gray-600">{workingDays} working day{workingDays !== 1 ? 's' : ''}</p>
              )}
              {overlapWarning && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  These dates overlap with an existing pending or approved request.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="font-medium">Day type</p>
              {['FULL', ...(selectedType?.allow_half_day ? ['HALF_AM', 'HALF_PM'] : []), ...(selectedType?.allow_hourly ? ['HOURLY'] : [])].map(dt => (
                <button
                  key={dt}
                  onClick={() => setDayType(dt)}
                  className={`w-full text-left p-3 rounded-lg border text-sm ${dayType === dt ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  {{ FULL: 'Full day', HALF_AM: 'Half day (AM)', HALF_PM: 'Half day (PM)', HOURLY: 'Specific hours' }[dt]}
                </button>
              ))}
              {dayType === 'HOURLY' && (
                <input
                  type="number"
                  placeholder="Hours"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="font-medium">Add a note (optional)</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Reason or additional details..."
                className="w-full border rounded-md px-3 py-2 text-sm h-24 resize-none"
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <p className="font-medium">Summary</p>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><span className="text-gray-500">Type:</span> {selectedType?.name}</p>
                <p><span className="text-gray-500">Dates:</span> {startDate} {endDate ? `– ${endDate}` : ''}</p>
                <p><span className="text-gray-500">Working days:</span> {workingDays}</p>
                {balance && (
                  <>
                    <p><span className="text-gray-500">Current balance:</span> {formatDays(balance.available)} days</p>
                    <p><span className="text-gray-500">After request:</span> {formatDays(balance.available - workingDays)} days</p>
                  </>
                )}
              </div>
              {warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">{w.reason}</p>
              ))}
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-red-600 bg-red-50 p-2 rounded">{e.message}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>
        ) : <div />}
        {step < 5 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={
              (step === 1 && !leaveTypeId) ||
              (step === 2 && (!startDate || !endDate))
            }
          >
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit request'}
          </Button>
        )}
      </div>
    </div>
  )
}
