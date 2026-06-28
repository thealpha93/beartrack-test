import { redirect } from 'next/navigation'

export default async function AdminIndexPage({ params }) {
  const { slug } = await params
  redirect(`/${slug}/admin/leave-types`)
}
