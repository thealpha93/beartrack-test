import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function EmptyState({ label, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-gray-500 mb-4">{label}</p>
      {action && (
        <Link href={action.href} className={buttonVariants({ variant: 'outline' })}>
          {action.label}
        </Link>
      )}
    </div>
  )
}
