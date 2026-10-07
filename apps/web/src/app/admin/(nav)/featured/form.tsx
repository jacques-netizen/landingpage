'use client'

import { Button, Field, Input, Select, Textarea } from '@mde/ui'
import { useActionState, useState } from 'react'
import { Notice } from '../_components/ui'
import { saveFeaturedAction, type FeaturedState } from './actions'

type Campaign = { id: string; title: string; tags: string }
const AUTO = 'auto'

export function FeaturedForm({
  campaigns,
  values,
}: {
  campaigns: Campaign[]
  values: { campaign: string; title: string; body: string; tags: string }
}) {
  const [state, action, pending] = useActionState<FeaturedState, FormData>(saveFeaturedAction, {})
  const [choice, setChoice] = useState(values.campaign || AUTO)
  const picked = campaigns.find((c) => c.id === choice)
  return (
    <form action={action} className="flex max-w-[640px] flex-col gap-6">
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      <input type="hidden" name="campaign" value={choice === AUTO ? '' : choice} />
      <Field label="Campaign">
        {(p) => (
          <Select
            id={p.id}
            aria-describedby={p.describedBy}
            value={choice}
            onValueChange={setChoice}
            options={[
              { value: AUTO, label: 'Automatic (longest-running live campaign)' },
              ...campaigns.map((c) => ({ value: c.id, label: c.title })),
            ]}
          />
        )}
      </Field>
      {campaigns.length === 0 ? (
        <p className="m-0 text-[13px] text-muted-2">No live public campaigns yet. Publish one first.</p>
      ) : null}
      {picked ? (
        <>
          <Field label="Headline (optional)" helper={`Leave empty to use "${picked.title}".`}>
            {(p) => (
              <Input
                id={p.id}
                aria-describedby={p.describedBy}
                name="title"
                defaultValue={values.title}
                maxLength={80}
              />
            )}
          </Field>
          <Field label="Text (optional)" helper="One or two sentences under the headline.">
            {(p) => (
              <Textarea
                id={p.id}
                aria-describedby={p.describedBy}
                name="body"
                defaultValue={values.body}
                maxLength={220}
              />
            )}
          </Field>
          <Field label="Tags (optional)" helper={`Two tags, separated by a comma. Leave empty for "${picked.tags}".`}>
            {(p) => <Input id={p.id} aria-describedby={p.describedBy} name="tags" defaultValue={values.tags} />}
          </Field>
        </>
      ) : null}
      <div>
        <Button type="submit" loading={pending}>
          Save featured campaign
        </Button>
      </div>
    </form>
  )
}
