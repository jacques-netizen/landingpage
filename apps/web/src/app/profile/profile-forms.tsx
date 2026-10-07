'use client'

import { Button, Field, Input } from '@mde/ui'
import { useRouter } from 'next/navigation'
import { useActionState, useRef, useState } from 'react'
import { AvatarImage } from '@/components/avatar-image'
import { panel } from '@/components/app-ui'
import { changePasswordAction, saveProfileAction, type ProfileState } from './actions'

function Notice({ state }: { state: ProfileState }) {
  if (state.ok)
    return (
      <p role="status" className="m-0 text-[13px] font-semibold text-[#4FB286]">
        {state.ok}
      </p>
    )
  if (state.error)
    return (
      <p role="alert" className="m-0 text-[13px] text-bad">
        {state.error}
      </p>
    )
  return null
}

function AppField({
  label,
  name,
  error,
  helper,
  ...rest
}: { label: string; name: string; error?: string; helper?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field tone="app" label={label} error={error} helper={helper}>
      {(p) => <Input tone="app" id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} name={name} {...rest} />}
    </Field>
  )
}

export function ProfileForms(props: {
  email: string
  username: string
  discord: string
  image: string | null
  hasPassword: boolean
}) {
  const router = useRouter()
  const [image, setImage] = useState(props.image)
  const [busy, setBusy] = useState(false)
  const [picError, setPicError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [profile, saveProfile, savingProfile] = useActionState<ProfileState, FormData>(saveProfileAction, {})
  const [pw, savePassword, savingPassword] = useActionState<ProfileState, FormData>(changePasswordAction, {})

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setPicError(null)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: file })
      const body = (await res.json().catch(() => null)) as { url?: string; error?: { message: string } } | null
      if (!res.ok || !body?.url) throw new Error(body?.error?.message ?? 'The upload failed. Try again.')
      setImage(body.url)
      router.refresh()
    } catch (e) {
      setPicError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    await fetch('/api/profile/avatar', { method: 'DELETE' })
    setImage(null)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Profile picture" className={`${panel} flex flex-wrap items-center gap-6 p-6`}>
        <AvatarImage src={image} name={props.username || props.email} size={96} />
        <div className="flex flex-col gap-3">
          <div className="text-[15px] font-bold">Profile picture</div>
          <div className="text-[13px] text-[var(--t-muted)]">
            PNG, JPG or WebP, up to 5 MB. Helps staff recognise you.
          </div>
          <div className="flex gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              aria-label="Choose a profile picture"
              onChange={(e) => {
                void upload(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button tone="app" size="sm" type="button" loading={busy} onClick={() => input.current?.click()}>
              {image ? 'Change picture' : 'Upload picture'}
            </Button>
            {image ? (
              <Button tone="app" size="sm" variant="secondary" type="button" disabled={busy} onClick={remove}>
                Remove
              </Button>
            ) : null}
          </div>
          {picError ? (
            <p role="alert" className="m-0 text-[13px] text-bad">
              {picError}
            </p>
          ) : null}
        </div>
      </section>

      <form action={saveProfile} noValidate aria-label="Profile details" className={`${panel} flex flex-col gap-5 p-6`}>
        <AppField
          label="Username"
          name="username"
          defaultValue={props.username}
          error={profile.fields?.username}
          helper="Shown instead of your email."
          autoCapitalize="none"
          spellCheck={false}
        />
        <AppField
          label="Discord username (optional)"
          name="discord"
          defaultValue={props.discord}
          error={profile.fields?.discord}
          autoCapitalize="none"
          spellCheck={false}
        />
        <div className="text-[13px] text-[var(--t-muted)]">Email: {props.email}</div>
        <div className="flex items-center gap-4">
          <Button tone="app" size="sm" type="submit" loading={savingProfile}>
            Save profile
          </Button>
          <Notice state={profile} />
        </div>
      </form>

      <form action={savePassword} noValidate aria-label="Password" className={`${panel} flex flex-col gap-5 p-6`}>
        <div className="text-[15px] font-bold">{props.hasPassword ? 'Change password' : 'Set a password'}</div>
        {props.hasPassword ? (
          <AppField
            label="Current password"
            name="current"
            type="password"
            autoComplete="current-password"
            error={pw.fields?.current}
          />
        ) : null}
        <AppField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={pw.fields?.password}
          helper="At least 8 characters. Other devices will need a code from your email next time."
        />
        <div className="flex items-center gap-4">
          <Button tone="app" size="sm" type="submit" loading={savingPassword}>
            {props.hasPassword ? 'Change password' : 'Set password'}
          </Button>
          <Notice state={pw} />
        </div>
      </form>
    </div>
  )
}
