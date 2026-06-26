'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { acceptInvite } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function InvitePage() {
  const { slug, token } = useParams()
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.target)
    if (fd.get('password') !== fd.get('confirmPassword')) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    const result = await acceptInvite(token, fd.get('name'), fd.get('password'))
    setLoading(false)
    if (!result.ok) { setError(result.errors[0].message); return }
    router.push(`/${slug}/dashboard`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Create your account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="name" placeholder="Full name" required />
            <Input name="password" type="password" placeholder="Password" required />
            <Input name="confirmPassword" type="password" placeholder="Confirm password" required />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
