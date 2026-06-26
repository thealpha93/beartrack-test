'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { resetPassword, requestPasswordReset } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const { slug, token } = useParams()
  const router = useRouter()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // If no token in URL, show the "request reset" form
  if (!token) {
    return <RequestResetForm slug={slug} />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.target)
    if (fd.get('password') !== fd.get('confirm')) {
      setError('Passwords do not match'); setLoading(false); return
    }
    const result = await resetPassword(token, fd.get('password'))
    setLoading(false)
    if (!result.ok) { setError(result.errors[0].message); return }
    router.push(`/${slug}/login`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Set new password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="password" type="password" placeholder="New password" required />
            <Input name="confirm" type="password" placeholder="Confirm password" required />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Saving...' : 'Save password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function RequestResetForm({ slug }) {
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
