'use client'

import {
  AdminNav,
  AvatarStack,
  Button,
  Checkbox,
  Chip,
  Dialog,
  Drawer,
  DrawerSection,
  EmptyState,
  ErrorState,
  Field,
  Footer,
  Input,
  LineChart,
  LoadingRows,
  MoneyFigure,
  MoneyLine,
  Notice,
  PageContainer,
  PublicNav,
  Segmented,
  Select,
  Skeleton,
  Star,
  StatusBadge,
  Table,
  Tabs,
  Textarea,
  ToastProvider,
  Toggle,
  TYPE_CHIP,
  useToast,
  type Column,
} from '@mde/ui'
import { useState, type ReactNode } from 'react'

// Every shared component in every state, in the paper tone and in both app themes (Dark, Glass).
// Values come from the locked mockups; 05_DESIGN_SYSTEM.md fills in states the mockups do not show.

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-0 border-t border-solid border-line py-12">
      <h2 className="m-0 font-serif text-[40px] leading-[1.05] font-normal">{title}</h2>
      {note ? <p className="mt-2 mb-0 max-w-[640px] text-[15px] text-muted-2">{note}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-6 border-0 border-b border-solid border-line py-5 last:border-b-0">
      <div className="pt-3 text-[13px] text-muted-2">{label}</div>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

// A themed app surface, as the campaigns and wallet screens draw it.
function AppPanel({ theme, children }: { theme: 'dark' | 'glass'; children: ReactNode }) {
  return (
    <div
      data-theme={theme}
      className="rounded-panel p-6 font-app text-[var(--t-text)]"
      style={{ background: 'var(--t-page)' }}
    >
      <div className="rounded-[22px] border border-solid border-[var(--t-card-line)] bg-[var(--t-card)] p-6 backdrop-blur-[18px]">
        <div className="mb-4 text-[12px] font-semibold tracking-[0.06em] text-[var(--t-muted)] uppercase">
          {theme === 'dark' ? 'Dark (default)' : 'Glass'}
        </div>
        <div className="flex flex-col gap-5">{children}</div>
      </div>
    </div>
  )
}

const SWATCHES: [string, string][] = [
  ['page', '#F2EEE6'],
  ['ink', '#1A1510'],
  ['line', '#E0D6C6'],
  ['sand', '#CDBFA8'],
  ['muted', '#8A8378'],
  ['muted-2', '#6E675C'],
  ['curve', '#BDB4A4'],
  ['brand-page', '#EEE9DB'],
  ['brand-line', '#D8CDB9'],
  ['panel', '#F5F1E8'],
  ['gold', '#A8843A'],
  ['gold-ink', '#8A6A22'],
  ['gold-soft', '#D8C58F'],
  ['night', '#120F0B'],
  ['cream', '#F4F1EA'],
  ['ok', '#4FB286'],
  ['ok-ink', '#2F7D4F'],
  ['pending', '#E0A94A'],
  ['warn', '#B26A00'],
  ['flagged', '#E26B5E'],
  ['bad', '#B3261E'],
]

const TYPE: [string, string, string][] = [
  ['Hero display', "400 104px/0.92 'EB Garamond'", 'Post it. Watch it grow.'],
  ['Brand hero', "400 76px/0.96 'EB Garamond'", 'Reach that ads can’t buy.'],
  ['Section title', "400 64px/1.02 'EB Garamond'", 'How it works'],
  ['Card title', "400 44px/1.04 'EB Garamond'", 'Releases that travel'],
  ['Big number', "400 40px/1 'EB Garamond'", '$1,250.00'],
  ['Page title', "400 28px 'EB Garamond'", 'Review queue'],
  ['Lead', '400 18px/1.45 Archivo', 'Join a campaign, post on your own account, and earn for every view that counts.'],
  ['Body', '400 15px/1.5 Archivo', 'Plain words. Short sentences. Say what happens and what it costs.'],
  ['Small', '400 13px/1.45 Archivo', 'Helper text and table cells.'],
  ['Eyebrow', "500 12px 'Geist Mono'", 'CASE STUDIES'],
  ['App title', "700 44px/1.05 'Plus Jakarta Sans'", 'Sample clipping campaign'],
  ['App heading', "700 22px 'Plus Jakarta Sans'", 'Active campaigns'],
  ['App body', "500 15px/1.5 'Plus Jakarta Sans'", 'Cut the best moments and post on your own account.'],
  ['Mono', "400 12px 'Geist Mono'", 'MDE-7K4Q · not_linked_account'],
]

type TxRow = {
  id: string
  date: string
  description: string
  status: 'ok' | 'warn' | 'bad' | 'neutral'
  statusLabel: string
  cents: number
}
const TX: TxRow[] = [
  {
    id: '1',
    date: 'Oct 2',
    description: 'Styleguide example row',
    status: 'ok',
    statusLabel: 'Available',
    cents: 12000,
  },
  {
    id: '2',
    date: 'Oct 1',
    description: 'Styleguide example row',
    status: 'warn',
    statusLabel: 'Pending',
    cents: 6240,
  },
  { id: '3', date: 'Sep 27', description: 'Styleguide example row', status: 'bad', statusLabel: 'Held', cents: 800 },
  {
    id: '4',
    date: 'Sep 27',
    description: 'Styleguide example row',
    status: 'neutral',
    statusLabel: 'Paid out',
    cents: 4500,
  },
]
const TX_COLUMNS: Column<TxRow>[] = [
  { key: 'date', header: 'Date', cell: (r) => r.date },
  { key: 'description', header: 'Description', cell: (r) => r.description },
  { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status}>{r.statusLabel}</StatusBadge> },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    cell: (r) => <span className="font-serif text-[17px]">${(r.cents / 100).toFixed(2)}</span>,
  },
]

function ToastDemo() {
  const toast = useToast()
  return (
    <Button variant="secondary" onClick={() => toast('Settings saved.')}>
      Show a toast
    </Button>
  )
}

export function StyleguideClient() {
  const [selectValue, setSelectValue] = useState<string>()
  const [theme, setTheme] = useState('dark')
  const [checked, setChecked] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(true)

  return (
    <ToastProvider>
      <main className="min-h-screen bg-page pb-24 font-sans text-ink">
        <PageContainer>
          <header className="pt-16 pb-12">
            <p className="m-0 font-mono text-[12px] tracking-[0.28em] text-gold-ink uppercase">Styleguide</p>
            <h1 className="mt-6 mb-0 font-serif text-[64px] leading-none font-normal tracking-[-0.02em]">
              Shared components
              <br />
              <em>from the locked design.</em>
            </h1>
            <p className="mt-6 mb-0 max-w-[640px] text-[18px] leading-[1.45] text-muted">
              Paper is the light family (public pages, client report, staff admin). App is the creator app family, in
              the Dark and Glass themes. Example rows on this page are for layout only.
            </p>
          </header>

          <Section title="Colour" note="Taken from the mockups. Status colours are for dots and short words only.">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {SWATCHES.map(([name, hex]) => (
                <div key={name}>
                  <div className="h-16 rounded-[14px] border border-solid border-line" style={{ background: hex }} />
                  <div className="mt-2 text-[13px]">{name}</div>
                  <div className="font-mono text-[12px] text-muted-2">{hex}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {(['dark', 'glass'] as const).map((t) => (
                <div key={t} data-theme={t} className="h-28 rounded-[22px] p-5" style={{ background: 'var(--t-page)' }}>
                  <div className="h-full rounded-[14px] border border-solid border-[var(--t-card-line)] bg-[var(--t-card)] p-4 font-app text-[13px] font-semibold text-[var(--t-text)]">
                    {t === 'dark' ? 'Dark theme surface' : 'Glass theme surface'}
                    <div className="mt-1 font-medium text-[var(--t-muted)]">Muted text</div>
                  </div>
                </div>
              ))}
            </div>
            <Row label="Campaign type chips">
              {Object.entries(TYPE_CHIP).map(([type, colour]) => (
                <span
                  key={type}
                  className="inline-flex h-8 items-center rounded-chip px-3 text-[13px]"
                  style={{ background: colour }}
                >
                  {type === 'ugc' ? 'UGC' : type[0]!.toUpperCase() + type.slice(1)}
                </span>
              ))}
            </Row>
          </Section>

          <Section
            title="Type"
            note="Serif for display and big numbers, Archivo for the paper family, Plus Jakarta Sans in the app."
          >
            {TYPE.map(([name, font, sample]) => (
              <div
                key={name}
                className="grid grid-cols-[160px_1fr] items-baseline gap-6 border-0 border-b border-solid border-line py-4"
              >
                <div className="text-[13px] text-muted-2">
                  {name}
                  <div className="font-mono text-[11px]">{font}</div>
                </div>
                <div style={{ font, letterSpacing: font.includes('Garamond') ? '-0.03em' : undefined }}>{sample}</div>
              </div>
            ))}
          </Section>

          <Section title="Spacing and shape">
            <Row label="Spacing">
              {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128].map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <div className="bg-ink" style={{ width: s, height: 12 }} />
                  <span className="text-[12px] text-muted-2">{s}</span>
                </div>
              ))}
            </Row>
            <Row label="Radii">
              {[
                ['pill', 999],
                ['tile', 10],
                ['chip', 12],
                ['input', 14],
                ['card', 24],
                ['float', 26],
                ['panel', 36],
              ].map(([n, r]) => (
                <div key={n} className="flex flex-col items-center gap-2">
                  <div
                    className="size-16 border border-solid border-sand bg-[#FBF7F0]"
                    style={{ borderRadius: Number(r) }}
                  />
                  <span className="text-[12px] text-muted-2">{n}</span>
                </div>
              ))}
            </Row>
            <Row label="Shadows">
              {[
                ['Floating card', '0 20px 50px rgba(26,21,16,0.09)'],
                ['Glass panel', '0 18px 44px rgba(26,21,16,0.08)'],
                ['Dialog', '0 32px 80px rgba(26,21,16,0.14)'],
              ].map(([n, s]) => (
                <div
                  key={n}
                  className="flex h-24 w-44 items-end rounded-float bg-white p-4 text-[13px]"
                  style={{ boxShadow: s }}
                >
                  {n}
                </div>
              ))}
            </Row>
          </Section>

          <Section
            title="Buttons"
            note="Forward actions carry an arrow. Destructive actions use red text, never a red fill."
          >
            <Row label="Primary">
              <Button arrow>Start earning</Button>
              <Button size="sm">Download CSV</Button>
              <Button loading>Saving</Button>
              <Button disabled>Not available</Button>
            </Row>
            <Row label="Secondary">
              <Button variant="secondary">Cancel</Button>
              <Button variant="secondary" size="sm">
                Download CSV
              </Button>
              <Button variant="secondary" disabled>
                Not available
              </Button>
            </Row>
            <Row label="Destructive">
              <Button variant="destructive">Reject</Button>
              <Button variant="destructive" disabled>
                Reject
              </Button>
            </Row>
            <Row label="Quiet">
              <Button variant="quiet">View rules</Button>
              <Button variant="quiet" disabled>
                View rules
              </Button>
            </Row>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {(['dark', 'glass'] as const).map((t) => (
                <AppPanel key={t} theme={t}>
                  <div className="flex flex-wrap gap-3">
                    <Button tone="app" arrow>
                      View campaign
                    </Button>
                    <Button tone="app" variant="secondary">
                      $4,800.00 left
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button tone="app" size="sm">
                      Try again
                    </Button>
                    <Button tone="app" loading>
                      Saving
                    </Button>
                    <Button tone="app" disabled>
                      Withdraw
                    </Button>
                    <Button tone="app" variant="quiet">
                      Change
                    </Button>
                  </div>
                </AppPanel>
              ))}
            </div>
          </Section>

          <Section
            title="Inputs"
            note="Label above, helper below, errors with an icon and words. Focus shows a 2px ring."
          >
            <div className="grid grid-cols-2 gap-8">
              <Field label="Display name" helper="Shown on public campaign lists unless your profile is private.">
                {(p) => <Input id={p.id} aria-describedby={p.describedBy} placeholder="Your name" />}
              </Field>
              <Field label="Email" error="Enter an email address, like name@example.com.">
                {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} defaultValue="name@" />}
              </Field>
              <Field label="Access code" helper="Private campaigns need a code from staff.">
                {(p) => <Input id={p.id} aria-describedby={p.describedBy} disabled defaultValue="Disabled" />}
              </Field>
              <Field label="Platform">
                {(p) => (
                  <Select
                    id={p.id}
                    value={selectValue}
                    onValueChange={setSelectValue}
                    placeholder="Choose a platform"
                    options={[
                      { value: 'tiktok', label: 'TikTok' },
                      { value: 'instagram', label: 'Instagram' },
                      { value: 'youtube', label: 'YouTube' },
                      { value: 'x', label: 'X', disabled: true },
                    ]}
                  />
                )}
              </Field>
              <div className="col-span-2">
                <Field label="Note to creator" helper="Up to 1,000 characters.">
                  {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} placeholder="Note to creator" />}
                </Field>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {(['dark', 'glass'] as const).map((t) => (
                <AppPanel key={t} theme={t}>
                  <Field label="Search" tone="app">
                    {(p) => <Input tone="app" id={p.id} placeholder="Search campaigns, labels or platforms" />}
                  </Field>
                  <Field label="Amount" tone="app" error="The minimum withdrawal is $20.00.">
                    {(p) => (
                      <Input
                        tone="app"
                        id={p.id}
                        aria-describedby={p.describedBy}
                        invalid={p.invalid}
                        defaultValue="12.00"
                      />
                    )}
                  </Field>
                </AppPanel>
              ))}
            </div>
          </Section>

          <Section title="Checkbox and toggle" note="Consent boxes are never ticked in advance.">
            <Row label="Checkbox">
              <Checkbox checked={checked} onCheckedChange={setChecked}>
                I am 18 or older
              </Checkbox>
              <Checkbox defaultChecked>Checked</Checkbox>
              <Checkbox invalid>Error: tick to continue</Checkbox>
              <Checkbox disabled>Disabled</Checkbox>
            </Row>
            <Row label="Toggle">
              <Toggle>Email notifications</Toggle>
              <Toggle defaultChecked>On</Toggle>
              <Toggle disabled>Disabled</Toggle>
            </Row>
          </Section>

          <Section title="Tabs">
            <Tabs
              tabs={[
                {
                  value: 'tx',
                  label: 'Transactions',
                  content: <p className="text-[15px] text-muted-2">Transactions panel.</p>,
                },
                {
                  value: 'wd',
                  label: 'Withdrawals',
                  content: <p className="text-[15px] text-muted-2">Withdrawals panel.</p>,
                },
              ]}
            />
            <div className="mt-6 grid grid-cols-2 gap-4">
              {(['dark', 'glass'] as const).map((t) => (
                <AppPanel key={t} theme={t}>
                  <Tabs
                    tone="app"
                    tabs={[
                      { value: 'tx', label: 'Overview', content: null },
                      { value: 'wd', label: 'Withdrawals', content: null },
                    ]}
                  />
                  <Segmented
                    tone="app"
                    label="Theme"
                    value={theme}
                    onChange={setTheme}
                    options={[
                      { value: 'dark', label: 'Dark' },
                      { value: 'glass', label: 'Glass' },
                    ]}
                  />
                </AppPanel>
              ))}
            </div>
          </Section>

          <Section title="Table" note="Hairline rows, no zebra, sticky header. Dense rows for staff screens.">
            <Table caption="Example transactions" columns={TX_COLUMNS} rows={TX} rowKey={(r) => r.id} />
            <div className="mt-10">
              <Table dense caption="Example transactions, dense" columns={TX_COLUMNS} rows={TX} rowKey={(r) => r.id} />
            </div>
            <div className="mt-10">
              <Table
                caption="Empty table"
                columns={TX_COLUMNS}
                rows={[]}
                rowKey={(r) => r.id}
                empty={<EmptyState body="No transactions yet." action={<Button size="sm">Browse campaigns</Button>} />}
              />
            </div>
            <div className="mt-10">
              <LoadingRows label="Loading transactions" />
            </div>
          </Section>

          <Section title="Status, chips and avatars">
            <Row label="Status">
              <StatusBadge status="ok">Approved</StatusBadge>
              <StatusBadge status="warn">In review</StatusBadge>
              <StatusBadge status="bad">Rejected</StatusBadge>
              <StatusBadge status="neutral">Final</StatusBadge>
            </Row>
            <Row label="Chips">
              <Chip>Missing hashtag</Chip>
              <Chip selected>Too short</Chip>
              <Chip>Reused clip</Chip>
            </Row>
            <Row label="Avatar stack">
              <AvatarStack
                label="Creators on this campaign"
                people={[{ name: 'Ada Lane' }, { name: 'Ben Ode' }, { name: 'Cy Moe' }]}
                more
              />
            </Row>
            <Row label="Ornament">
              <Star />
              <Star size={24} color="#A8843A" />
            </Row>
          </Section>

          <Section title="Money" note="Whole cents in, dollars out. Cents in the secondary colour.">
            <div className="flex flex-wrap gap-14">
              <MoneyFigure cents={18420} label="Available" />
              <MoneyFigure cents={480000} label="Left in budget" />
            </div>
            <MoneyLine cents={6240} label="Pending" className="mt-6" />
          </Section>

          <Section
            title="Chart"
            note="One line, no fill, a dot on the latest point, with a text summary and a table view."
          >
            <LineChart
              title="Views over time (styleguide example)"
              summary="Example line rising from 1,200 to 9,800 views over six checks."
              points={[
                { label: 'Check 1', value: 1200 },
                { label: 'Check 2', value: 2100 },
                { label: 'Check 3', value: 3900 },
                { label: 'Check 4', value: 5600 },
                { label: 'Check 5', value: 8200 },
                { label: 'Check 6', value: 9800 },
              ]}
            />
          </Section>

          <Section title="Drawer, dialog and toast">
            <Row label="Overlays">
              <Drawer
                title="Submission"
                description="TikTok · Styleguide example"
                trigger={<Button variant="secondary">Open drawer</Button>}
                footer={<Button arrow>Appeal</Button>}
              >
                <DrawerSection title="Summary">
                  <StatusBadge status="bad">Rejected</StatusBadge>
                  <p className="mt-3 mb-0 text-[15px]">A required hashtag is missing.</p>
                </DrawerSection>
                <DrawerSection title="History">
                  <p className="m-0 text-[13px] text-muted-2">Submitted, checked, rejected.</p>
                </DrawerSection>
              </Drawer>
              <Dialog
                title="Withdraw"
                description="The fee and total are shown before you confirm."
                trigger={<Button variant="secondary">Open dialog</Button>}
                footer={<Button arrow>Confirm</Button>}
              >
                <MoneyLine cents={2000} label="Amount" />
                <MoneyLine cents={0} label="Fee" />
              </Dialog>
              <ToastDemo />
            </Row>
            <Row label="Notice">
              {noticeOpen ? (
                <div data-theme="dark" className="w-full">
                  <Notice tone="paper" onDismiss={() => setNoticeOpen(false)}>
                    Withdrawal requested. It appears under Withdrawals once staff review it.
                  </Notice>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setNoticeOpen(true)}>
                  Show notice
                </Button>
              )}
            </Row>
          </Section>

          <Section title="Empty, error and loading">
            <div className="grid grid-cols-3 gap-6">
              <EmptyState body="No approved posts yet. Posts appear here once they pass review." />
              <ErrorState
                title="Could not load this page."
                body="Check your connection and try again."
                action={<Button size="sm">Try again</Button>}
              />
              <div className="flex flex-col gap-3 pt-10">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {(['dark', 'glass'] as const).map((t) => (
                <AppPanel key={t} theme={t}>
                  <EmptyState
                    tone="app"
                    title="No earnings yet."
                    body="Join a campaign and post to start earning."
                    action={
                      <Button tone="app" size="sm">
                        Browse campaigns
                      </Button>
                    }
                  />
                  <ErrorState
                    tone="app"
                    title="Could not load your wallet."
                    body="Your balance is safe. Check your connection and try again."
                    action={
                      <Button tone="app" size="sm">
                        Try again
                      </Button>
                    }
                  />
                  <LoadingRows tone="app" rows={3} />
                </AppPanel>
              ))}
            </div>
          </Section>

          <Section title="Navigation and footer">
            <div className="rounded-panel border border-solid border-line">
              <PublicNav
                links={[
                  { label: 'Campaigns', href: '/campaigns', active: true },
                  { label: 'Wallet', href: '/wallet' },
                ]}
                cta={{ label: 'Start earning', href: '/sign-up' }}
              />
            </div>
            <div className="mt-6 flex overflow-hidden rounded-panel border border-solid border-line">
              <AdminNav
                links={[
                  { label: 'Dashboard', href: '/admin' },
                  { label: 'Review queue', href: '/admin/review', active: true },
                  { label: 'Settings', href: '/admin/settings' },
                ]}
              />
              <div className="p-8">
                <h3 className="m-0 font-serif text-[28px] font-normal">Review queue</h3>
                <p className="mt-1 mb-0 text-[13px] text-muted-2">Oldest first</p>
              </div>
            </div>
          </Section>
        </PageContainer>
        <Footer
          legalLine="© 2026 Maison d’Élites. All rights reserved."
          columns={[
            {
              title: 'Legal',
              links: [{ label: 'Privacy Policy' }, { label: 'Creator Terms of Use' }, { label: 'Brand Terms of Use' }],
            },
            { title: 'Company', links: [{ label: 'Contact Us' }, { label: 'Support' }, { label: 'Careers' }] },
          ]}
        />
      </main>
    </ToastProvider>
  )
}
