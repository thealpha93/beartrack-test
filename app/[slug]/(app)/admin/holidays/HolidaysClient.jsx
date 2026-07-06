'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { addPublicHolidayAction, deletePublicHolidayAction } from '@/app/actions/admin'

export function HolidaysClient({ slug, year, holidays }) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleDelete(id) {
    setSaving(true)
    try {
      await deletePublicHolidayAction(id)
      router.refresh()
    } finally {
      setSaving(false)
      setConfirmDelete(null)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAddError(null)
    setSaving(true)
    try {
      const result = await addPublicHolidayAction({ date: newDate, name: newName })
      if (!result.ok) { setAddError(result.errors[0]?.message); return }
      setNewDate('')
      setNewName('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Public Holidays</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/${slug}/admin/holidays?year=${year - 1}`}
            className="px-2 py-1 border rounded hover:bg-gray-50"
          >
            ← {year - 1}
          </Link>
          <span className="font-medium px-2">{year}</span>
          <Link
            href={`/${slug}/admin/holidays?year=${year + 1}`}
            className="px-2 py-1 border rounded hover:bg-gray-50"
          >
            {year + 1} →
          </Link>
        </div>
      </div>

      {holidays.length === 0 ? (
        <EmptyState label={`No holidays for ${year}.`} />
      ) : (
        <Table className="rounded-md border bg-white">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map(h => (
              <TableRow key={h.id}>
                <TableCell>{h.date}</TableCell>
                <TableCell>{h.name}</TableCell>
                <TableCell className="text-right">
                  {confirmDelete === h.id ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-sm text-gray-600">Delete?</span>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(h.id)} disabled={saving}>Yes</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)} disabled={saving}>Cancel</Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirmDelete(h.id)}>Delete</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="rounded-md border bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Add holiday</h2>
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <Input
              type="date"
              required
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <Input
              type="text"
              required
              placeholder="Holiday name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>Add</Button>
        </form>
        {addError && <p className="text-sm text-red-700 mt-2">{addError}</p>}
      </div>
    </div>
  )
}
