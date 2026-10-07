'use client'

import { PLATFORM_LABELS, TEMPLATES, type CampaignType } from '@mde/campaigns/templates'
import { Button, Checkbox, Field, Input, Textarea } from '@mde/ui'
import { useActionState, useEffect, useState, type ReactNode } from 'react'
import { Notice } from '../_components/ui'
import { AssetsEditor, ClientPicker, CoverUpload, MoneyField } from './builder-parts'
import { saveCampaignAction, type BuilderState } from './actions'

export type BuilderValues = {
  title: string
  type: CampaignType
  clientId: string
  coverImageUrl: string
  briefMarkdown: string
  assets: string
  examplePosts: string
  platforms: string[]
  budget: string
  rate: string
  capPerPost: string
  capPerCreator: string
  minViewsToEarn: string
  minEngagement: string
  maxPostsPerAccount: string
  minFollowers: string
  minAccountAgeDays: string
  languages: string
  allowedRegions: string
  blockedRegions: string
  requiredHashtags: string
  requireAdDisclosure: boolean
  minDurationSeconds: string
  keepLiveDays: string
  visibility: 'public' | 'private'
  accessCode: string
  startAt: string | null
  endAt: string | null
  termsDraftMarkdown: string
  templateFields: Record<string, string | number | boolean>
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-0 border-t border-solid border-line py-8">
      <h2 className="m-0 font-app text-[16px] font-semibold">{title}</h2>
      {note ? <p className="mt-1 mb-0 text-[13px] text-muted-2">{note}</p> : null}
      <div className="mt-6 grid grid-cols-2 gap-5">{children}</div>
    </section>
  )
}

/** A date and time in the staff member's own time zone, sent to the server as an exact instant. */
function DateTimeField({
  name,
  label,
  helper,
  error,
  initial,
  disabled,
}: {
  name: string
  label: string
  helper?: string
  error?: string
  initial: string | null
  disabled?: boolean
}) {
  const [iso, setIso] = useState(initial ?? '')
  const [local, setLocal] = useState('')
  useEffect(() => {
    if (!initial) return
    const d = new Date(initial)
    const pad = (n: number) => String(n).padStart(2, '0')
    setLocal(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    )
  }, [initial])
  return (
    <Field label={label} helper={helper} error={error}>
      {(p) => (
        <>
          <Input
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            type="datetime-local"
            value={local}
            disabled={disabled}
            onChange={(e) => {
              setLocal(e.target.value)
              setIso(e.target.value ? new Date(e.target.value).toISOString() : '')
            }}
          />
          <input type="hidden" name={name} value={iso} />
        </>
      )}
    </Field>
  )
}

export function CampaignBuilder({
  id,
  initial,
  clients,
  locked,
}: {
  id: string | null
  initial: BuilderValues
  clients: { id: string; name: string }[]
  /** Fields that can no longer change (after funding or going live). */
  locked: string[]
}) {
  const [state, action, pending] = useActionState<BuilderState, FormData>(saveCampaignAction.bind(null, id), {})
  const [type] = useState<CampaignType>(initial.type)
  const [visibility, setVisibility] = useState(initial.visibility)
  const f = state.fields ?? {}
  const isLocked = (k: string) => locked.includes(k)
  const template = TEMPLATES[type]

  const text = (
    name: keyof BuilderValues,
    label: string,
    opts: { helper?: string; placeholder?: string; mode?: 'decimal' | 'numeric' } = {},
  ) => (
    <Field
      label={label}
      helper={isLocked(name) ? 'Fixed once the campaign is funded or live.' : opts.helper}
      error={f[name]}
    >
      {(p) => (
        <Input
          id={p.id}
          aria-describedby={p.describedBy}
          invalid={p.invalid}
          name={name}
          defaultValue={String(initial[name] ?? '')}
          placeholder={opts.placeholder}
          inputMode={opts.mode}
          readOnly={isLocked(name)}
        />
      )}
    </Field>
  )

  return (
    <form action={action} noValidate className="max-w-[860px]">
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <input type="hidden" name="type" value={type} />

      <Section title="The campaign" note={`${template.label} template. ${template.description}`}>
        <div className="col-span-2">{text('title', 'Title', { placeholder: 'Summer launch clips' })}</div>
        <div className="col-span-2">
          <ClientPicker
            clients={clients}
            defaultValue={initial.clientId}
            error={f.clientId}
            disabled={isLocked('clientId')}
          />
        </div>
        <CoverUpload defaultValue={initial.coverImageUrl} error={f.coverImageUrl} />
        <fieldset className="m-0 self-start border-0 p-0">
          <legend className="mb-3 text-[13px] font-medium">Platforms</legend>
          <div className="flex flex-col gap-3">
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <Checkbox key={value} name="platforms" value={value} defaultChecked={initial.platforms.includes(value)}>
                {label}
              </Checkbox>
            ))}
          </div>
          {f.platforms ? <p className="mt-2 mb-0 text-[13px] text-bad">{f.platforms}</p> : null}
        </fieldset>
        <div className="col-span-2">
          <Field label="Brief" helper="What creators should make, in plain words." error={f.briefMarkdown}>
            {(p) => (
              <Textarea
                id={p.id}
                aria-describedby={p.describedBy}
                name="briefMarkdown"
                defaultValue={initial.briefMarkdown}
                rows={5}
              />
            )}
          </Field>
        </div>
        <div className="col-span-2">
          <AssetsEditor defaultValue={initial.assets} error={f.assets} />
        </div>
        <div className="col-span-2">
          <Field label="Example posts" helper="Optional. Links to posts like the ones you want, one per line.">
            {(p) => (
              <Textarea
                id={p.id}
                aria-describedby={p.describedBy}
                name="examplePosts"
                defaultValue={initial.examplePosts}
                rows={3}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Budget and pay" note="Type amounts in dollars, like 2000 or 2k.">
        <MoneyField
          name="budget"
          label="Budget"
          helper={
            isLocked('budget')
              ? 'Fixed once the campaign is funded or live.'
              : 'The total creators can earn. The service fee is added on top.'
          }
          error={f.budget}
          defaultValue={initial.budget}
          placeholder="2000"
          readOnly={isLocked('budget')}
        />
        <MoneyField
          name="rate"
          label="Pay per 1,000 views"
          error={f.rate}
          defaultValue={initial.rate}
          placeholder="2"
        />
        {text('minViewsToEarn', 'Views before a post starts earning', {
          helper: 'Optional. Posts below this earn nothing until they pass it.',
          placeholder: '1000',
          mode: 'numeric',
        })}
      </Section>

      <Section title="Dates and access" note="Leave the end empty to run until the budget is used.">
        <DateTimeField name="startAt" label="Submissions open" error={f.startAt} initial={initial.startAt} />
        <DateTimeField name="endAt" label="Submissions close" error={f.endAt} initial={initial.endAt} />
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-3 text-[13px] font-medium">Who can join</legend>
          <div className="flex gap-6">
            {(['public', 'private'] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 text-[14px]">
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  checked={visibility === v}
                  onChange={() => setVisibility(v)}
                />
                {v === 'public' ? 'Everyone' : 'Only with an access code'}
              </label>
            ))}
          </div>
        </fieldset>
        {visibility === 'private' ? (
          text('accessCode', 'Access code', { placeholder: 'MDE-7K4Q' })
        ) : (
          <input type="hidden" name="accessCode" value="" />
        )}
      </Section>

      <Section
        title="Rules creators agree to"
        note="Shown before they join. Saved as a terms version when you publish, and again whenever it changes."
      >
        <div className="col-span-2">
          <Field label="Rules" error={f.termsDraftMarkdown}>
            {(p) => (
              <Textarea
                id={p.id}
                aria-describedby={p.describedBy}
                name="termsDraftMarkdown"
                defaultValue={initial.termsDraftMarkdown}
                rows={8}
              />
            )}
          </Field>
        </div>
      </Section>

      <details className="group border-0 border-t border-solid border-line py-8" open={hasAdvancedErrors(f)}>
        <summary className="cursor-pointer list-none font-app font-semibold text-[16px]">
          More rules <span className="font-sans text-[13px] text-muted-2">(optional: caps, accounts, content)</span>
        </summary>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <MoneyField
            name="capPerPost"
            label="Most one post can earn"
            helper={isLocked('capPerPost') ? 'Fixed once the campaign is live.' : 'Optional.'}
            error={f.capPerPost}
            defaultValue={initial.capPerPost}
            placeholder="300"
            readOnly={isLocked('capPerPost')}
          />
          <MoneyField
            name="capPerCreator"
            label="Most one creator can earn"
            helper={isLocked('capPerCreator') ? 'Fixed once the campaign is live.' : 'Optional.'}
            error={f.capPerCreator}
            defaultValue={initial.capPerCreator}
            placeholder="500"
            readOnly={isLocked('capPerCreator')}
          />
          {text('minEngagement', 'Minimum engagement (percent)', {
            helper: 'Optional. Likes, comments and shares divided by views.',
            placeholder: '1.5',
            mode: 'decimal',
          })}
          {text('minFollowers', 'Minimum followers', { helper: 'Optional.', mode: 'numeric' })}
          {text('minAccountAgeDays', 'Minimum account age (days)', { helper: 'Optional.', mode: 'numeric' })}
          {text('maxPostsPerAccount', 'Posts per linked account', { helper: 'Optional.', mode: 'numeric' })}
          {text('languages', 'Languages', { helper: 'Optional, separated by commas.' })}
          {text('allowedRegions', 'Allowed regions', {
            helper: 'Optional. Used only where audience data is available.',
          })}
          {text('blockedRegions', 'Blocked regions', { helper: 'Optional.' })}
          {text('requiredHashtags', 'Required hashtags', {
            helper: 'Separated by commas.',
            placeholder: '#brand',
          })}
          {text('minDurationSeconds', 'Minimum video length (seconds)', { helper: 'Optional.', mode: 'numeric' })}
          {text('keepLiveDays', 'Days the post must stay up after the campaign closes', { mode: 'numeric' })}
          {template.fields.map((tf) =>
            tf.kind === 'boolean' ? (
              <div key={tf.key} className="flex items-end pb-3">
                <Checkbox name={`tf.${tf.key}`} defaultChecked={initial.templateFields[tf.key] === true}>
                  {tf.label}
                </Checkbox>
              </div>
            ) : (
              <Field key={tf.key} label={tf.label} helper={tf.helper}>
                {(p) => (
                  <Input
                    id={p.id}
                    aria-describedby={p.describedBy}
                    name={`tf.${tf.key}`}
                    defaultValue={String(initial.templateFields[tf.key] ?? '')}
                    inputMode={tf.kind === 'number' ? 'numeric' : undefined}
                    placeholder={tf.kind === 'url' ? 'https://' : undefined}
                  />
                )}
              </Field>
            ),
          )}
          <p className="col-span-2 m-0 text-[13px] text-muted-2">Checks: {template.checks.join('. ')}.</p>
        </div>
      </details>

      <div className="sticky bottom-0 flex gap-3 border-0 border-t border-solid border-line bg-page py-5">
        <Button type="submit" loading={pending}>
          {id ? 'Save changes' : 'Save campaign'}
        </Button>
        {state.error ? <span className="self-center text-[13px] text-bad">{state.error}</span> : null}
      </div>
    </form>
  )
}

const ADVANCED = [
  'capPerPost',
  'capPerCreator',
  'minEngagement',
  'minFollowers',
  'minAccountAgeDays',
  'maxPostsPerAccount',
  'languages',
  'allowedRegions',
  'blockedRegions',
  'requiredHashtags',
  'minDurationSeconds',
  'keepLiveDays',
]
const hasAdvancedErrors = (f: Record<string, string>) => ADVANCED.some((k) => f[k])
