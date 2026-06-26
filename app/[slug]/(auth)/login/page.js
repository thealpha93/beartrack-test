'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { slug } = useParams()
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.target)
    const result = await login(slug, fd.get('email'), fd.get('password'))
    setLoading(false)
    if (!result.ok) {
      setError(result.errors[0].message)
      return
    }
    router.push(result.data.role === 'manager' || result.data.role === 'admin'
      ? `/${slug}/manager`
      : `/${slug}/dashboard`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Password" required />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <a href={`/${slug}/reset-password`} className="text-sm text-gray-500 block text-center">
              Forgot password?
            </a>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
