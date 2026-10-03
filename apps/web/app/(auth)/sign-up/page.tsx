import type { Metadata } from 'next'
import { enabledOAuth } from '@/auth'
import { AuthForm } from '../auth-form'

export const metadata: Metadata = { title: 'Create account' }
export const dynamic = 'force-dynamic'

export default function SignUp() {
  return <AuthForm mode="sign-up" oauth={enabledOAuth} />
}
