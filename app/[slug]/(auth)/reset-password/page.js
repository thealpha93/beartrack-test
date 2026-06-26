'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { requestPasswordReset } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RequestResetPage() {
  const { slug } = useParams()
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.target)
    await requestPasswordReset(slug, fd.get('email'))
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">If that email exists, a reset link has been logged to the console.</p>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Reset password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="email" type="email" placeholder="Email" required />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
