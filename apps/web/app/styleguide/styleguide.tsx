'use client'
import { useState, type ReactNode } from 'react'
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Checkbox,
  Dialog,
  Drawer,
  DrawerSection,
  EmptyState,
  ErrorState,
  Footer,
  FrostedCard,
  SiteHeader,
  IconChip,
  Input,
  LineChart,
  LoadingRows,
  Money,
  MoneyLine,
  NavPill,
  PageContainer,
  PlatformMark,
  Play,
  Search,
  Select,
  Skeleton,
  StatusDot,
  Star,
  SuccessNote,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
  ToastProvider,
  TR,
  TypeLabel,
  useToast,
  type CampaignType,
} from '@mde/ui'

const colours = [
  ['bg', '#F6F4EF', 'Page background'],
  ['surface', '#FFFFFF', 'Inputs, drawers, dialogs'],
  ['ink', '#111111', 'Primary text and buttons'],
  ['ink-2', '#5F5C57', 'Secondary text'],
  ['ink-3', '#8C8983', 'Hints and disabled'],
  ['line', '#E4E0D8', 'Hairlines'],
  ['line-strong', '#CFCAC0', 'Input borders'],
  ['chip-lime', '#DDF59A', 'Clipping'],
  ['chip-lavender', '#D3C7FF', 'Logo'],
  ['chip-peach', '#FFD3B0', 'Music'],
  ['chip-sky', '#CDE6FF', 'UGC'],
  ['ok', '#2F7D4F', 'Status: ok'],
  ['warn', '#B26A00', 'Status: warning'],
  ['bad', '#B3261E', 'Status: problem'],
] as const

const typeScale = [
  ['display-xl', 'text-display-xl', 'Post it.'],
  ['display-lg', 'text-display-lg', 'Campaigns'],
  ['display-md', 'text-display-md', 'Your balance'],
  ['display-sm', 'text-display-sm', 'Card title'],
] as const

const bodyScale = [
  ['body-lg', 'text-body-lg', 'Intro paragraphs read at this size.'],
  ['body', 'text-body', 'Default text for the whole product.'],
  ['body-sm', 'text-body-sm', 'Table cells and helper text.'],
  ['label', 'text-label font-medium', 'Form label'],
] as const

const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128]

const chartPoints = [
  { label: 'Day 1', value: 1200 },
  { label: 'Day 2', value: 4800 },
  { label: 'Day 3', value: 9100 },
  { label: 'Day 4', value: 12400 },
  { label: 'Day 5', value: 15800 },
  { label: 'Day 6', value: 17200 },
]

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h2 className="font-display text-display-md">{title}</h2>
        {note && <p className="max-w-xl text-body text-ink-2">{note}</p>}
      </div>
      <div className="flex flex-col gap-10">{children}</div>
    </section>
  )
}

function Sample({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-ink-2">{label}</p>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

function Demo() {
  const { toast } = useToast()
  const [tableState, setTableState] = useState<'loaded' | 'loading' | 'empty' | 'error'>('loaded')
  const [dialogOpen, setDialogOpen] = useState(false)
  const types: CampaignType[] = ['clipping', 'logo', 'music', 'ugc']

  return (
    <PageContainer width="app" className="pb-24 pt-12">
      <header className="pb-12">
        <h1 className="font-display text-display-lg">Styleguide</h1>
        <p className="mt-3 max-w-xl text-body-lg text-ink-2">
          Every shared component in every state. All sample values are placeholders for layout only.
        </p>
      </header>

      <Section
        title="Colour"
        note="Black and white on warm off-white. Colour appears only in small chips and status dots."
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {colours.map(([name, hex, use]) => (
            <div key={name} className="flex items-center gap-3">
              <span
                className="h-10 w-10 shrink-0 rounded-chip border border-line"
                style={{ background: hex }}
              />
              <span className="flex flex-col">
                <span className="text-body-sm font-medium">{name}</span>
                <span className="font-mono text-body-sm text-ink-2">{hex}</span>
                <span className="text-body-sm text-ink-2">{use}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Type"
        note="Serif for headlines and big numbers. Sans for everything else. Mono for codes and ids."
      >
        <div className="flex flex-col gap-6">
          {typeScale.map(([name, cls, sample]) => (
            <div key={name} className="flex flex-col gap-1 border-b border-line pb-4">
              <span className="text-body-sm text-ink-2">{name}</span>
              <span className={`font-display ${cls}`}>
                {sample} <em>Get paid.</em>
              </span>
            </div>
          ))}
          {bodyScale.map(([name, cls, sample]) => (
            <div key={name} className="flex flex-col gap-1 border-b border-line pb-4">
              <span className="text-body-sm text-ink-2">{name}</span>
              <span className={cls}>{sample}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <span className="text-body-sm text-ink-2">mono</span>
            <span className="font-mono text-body">MDE-7K4Q not_linked_account</span>
          </div>
        </div>
      </Section>

      <Section title="Spacing, radii and depth">
        <Sample label="Spacing scale in pixels">
          {spacing.map((s) => (
            <span key={s} className="flex flex-col items-center gap-2 text-body-sm text-ink-2">
              <span className="block bg-ink" style={{ width: s, height: 8 }} />
              {s}
            </span>
          ))}
        </Sample>
        <Sample label="Radii: pill, card 24, input 14, chip 12, drawer 28">
          {[
            ['pill', 'rounded-pill'],
            ['card', 'rounded-card'],
            ['input', 'rounded-input'],
            ['chip', 'rounded-chip'],
            ['drawer', 'rounded-drawer'],
          ].map(([name, cls]) => (
            <span
              key={name}
              className={`flex h-16 w-24 items-center justify-center border border-line-strong text-body-sm ${cls}`}
            >
              {name}
            </span>
          ))}
        </Sample>
        <Sample label="Shadows: only frosted cards and dialogs have one">
          <span className="flex h-20 w-40 items-center justify-center rounded-card bg-surface text-body-sm shadow-glass">
            Frosted card
          </span>
          <span className="flex h-20 w-40 items-center justify-center rounded-card bg-surface text-body-sm shadow-dialog">
            Dialog
          </span>
        </Sample>
      </Section>

      <Section title="Buttons">
        <Sample label="Primary: default, small, with arrow, disabled, loading">
          <Button forward>Start earning</Button>
          <Button size="sm">Save</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Saving</Button>
        </Sample>
        <Sample label="Secondary: default, with leading icon, disabled">
          <Button variant="secondary">Cancel</Button>
          <Button variant="secondary" leadingIcon={<Play size={10} />}>
            Watch video
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Sample>
        <Sample label="Quiet and destructive">
          <Button variant="quiet">Read the rules</Button>
          <Button variant="destructive">Reject post</Button>
          <Button variant="destructive" disabled>
            Reject post
          </Button>
        </Sample>
      </Section>

      <Section title="Navigation">
        <Sample label="Pill with the active link in a soft inner pill (desktop). Collapses to a menu button on mobile.">
          <div className="hidden md:block">
            <NavPill
              links={[
                { href: '#', label: 'Campaigns', active: true },
                { href: '#', label: 'How it works' },
                { href: '#', label: 'For clients' },
                { href: '#', label: 'Fees' },
              ]}
            />
          </div>
          <p className="text-body-sm text-ink-2 md:hidden">
            Resize wider than 768 pixels to see the pill.
          </p>
        </Sample>
      </Section>

      <Section
        title="Header, container and footer"
        note="The header collapses to a menu button on mobile. The footer shows the legal entity from config."
      >
        <div className="-mx-6 border-y border-line">
          <SiteHeader
            brandName="BRAND_NAME"
            links={[
              { href: '#', label: 'Campaigns', active: true },
              { href: '#', label: 'How it works' },
              { href: '#', label: 'Fees' },
            ]}
            cta={{ href: '#', label: 'Start earning' }}
          />
        </div>
        <div className="-mt-32 -mx-6">
          <Footer
            brandName="BRAND_NAME"
            legalEntity="LEGAL_ENTITY"
            links={[
              { href: '#', label: 'Terms' },
              { href: '#', label: 'Privacy' },
            ]}
          />
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            helper="We send a sign in link here."
          />
          <Input
            label="Email"
            type="email"
            defaultValue="not-an-email"
            error="Enter an email address like name@example.com."
          />
          <Input label="Display name" defaultValue="Locked value" disabled />
          <Select label="Platform" defaultValue="tiktok" helper="Choose where you post.">
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="x">X</option>
          </Select>
          <Select label="Platform" error="Choose a platform." defaultValue="">
            <option value="" disabled>
              Choose
            </option>
            <option value="tiktok">TikTok</option>
          </Select>
          <Textarea label="Note" helper="Optional. Up to 1,000 characters." />
        </div>
        <div className="flex max-w-xl flex-col gap-5">
          <Checkbox label="I am 18 or older" />
          <Checkbox label="I am 18 or older" defaultChecked />
          <Checkbox
            label="I accept the terms and the privacy policy"
            error="Tick this box to continue."
          />
          <Checkbox label="Unavailable option" disabled />
          <Toggle label="Private profile" />
          <Toggle label="Private profile" defaultChecked />
          <Toggle label="Unavailable setting" disabled />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions">
            <p className="text-body text-ink-2">Transaction rows appear here.</p>
          </TabsContent>
          <TabsContent value="withdrawals">
            <p className="text-body text-ink-2">Withdrawal rows appear here.</p>
          </TabsContent>
        </Tabs>
      </Section>

      <Section
        title="Tables"
        note="Hairlines, no zebra, no filled header. Switch the state to review all four."
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Table state">
          {(['loaded', 'loading', 'empty', 'error'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={tableState === s ? 'primary' : 'secondary'}
              onClick={() => setTableState(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        {tableState === 'loading' && <LoadingRows label="Loading submissions" />}
        {tableState === 'empty' && (
          <EmptyState
            message="You have not submitted a post yet."
            action={<Button size="sm">Browse campaigns</Button>}
          />
        )}
        {tableState === 'error' && (
          <ErrorState
            message="We could not load your submissions."
            action={
              <Button size="sm" variant="secondary">
                Try again
              </Button>
            }
          />
        )}
        {tableState === 'loaded' && (
          <Table>
            <THead>
              <TR>
                <TH>Campaign</TH>
                <TH>State</TH>
                <TH className="text-right">Counted views</TH>
                <TH className="text-right">Earned</TH>
              </TR>
            </THead>
            <TBody>
              <TR interactive>
                <TD>Sample campaign A</TD>
                <TD>
                  <StatusDot tone="ok">Earning</StatusDot>
                </TD>
                <TD numeric>2,500</TD>
                <TD numeric>$5.00</TD>
              </TR>
              <TR interactive>
                <TD>Sample campaign B</TD>
                <TD>
                  <StatusDot tone="warn">In review</StatusDot>
                </TD>
                <TD numeric>0</TD>
                <TD numeric>$0.00</TD>
              </TR>
              <TR interactive>
                <TD>Sample campaign C</TD>
                <TD>
                  <StatusDot tone="bad">Rejected</StatusDot>
                </TD>
                <TD numeric>0</TD>
                <TD numeric>$0.00</TD>
              </TR>
              <TR interactive>
                <TD>Sample campaign D</TD>
                <TD>
                  <StatusDot>Checking</StatusDot>
                </TD>
                <TD numeric>0</TD>
                <TD numeric>$0.00</TD>
              </TR>
            </TBody>
          </Table>
        )}
      </Section>

      <Section title="Status and badges">
        <Sample label="Dot plus word, never a coloured pill">
          <StatusDot tone="ok">Approved</StatusDot>
          <StatusDot tone="warn">In review</StatusDot>
          <StatusDot tone="bad">Rejected</StatusDot>
          <StatusDot>Checking</StatusDot>
          <Badge>Joined</Badge>
        </Sample>
      </Section>

      <Section title="Chips and ornaments">
        <Sample label="Campaign type chips">
          {types.map((t) => (
            <IconChip key={t} type={t} />
          ))}
        </Sample>
        <Sample label="With labels">
          {types.map((t) => (
            <TypeLabel key={t} type={t} />
          ))}
        </Sample>
        <Sample label="Platform marks and the brand star (at most two stars on a screen)">
          <PlatformMark platform="tiktok" />
          <PlatformMark platform="instagram" />
          <PlatformMark platform="youtube" />
          <PlatformMark platform="x" />
          <Star size={20} />
        </Sample>
      </Section>

      <Section
        title="Avatars"
        note="Show a stack only when it reflects real creators on that campaign."
      >
        <Sample label="Single avatar and a stack of placeholders">
          <Avatar person={{ name: 'Sample Person' }} />
          <AvatarStack
            people={[{ name: 'Alex Rivera' }, { name: 'Sam Okoye' }, { name: 'Jo Lindqvist' }]}
          />
        </Sample>
      </Section>

      <Section
        title="Money display"
        note="Serif with tabular numerals. Cents in the secondary ink. Pending and available are lines of text, not boxes."
      >
        <div className="flex flex-col gap-6">
          <MoneyLine label="Available" cents={123456} />
          <MoneyLine label="Pending" cents={5000} size="sm" />
          <MoneyLine label="Left in budget" cents={8500000} />
          <p className="text-body-sm text-ink-2">
            Zero state: <Money cents={0} size="sm" />
          </p>
        </div>
      </Section>

      <Section
        title="Charts"
        note="One 1.5px line, hairline grid, a dot on the latest point. Text summary and table view always available."
      >
        <LineChart
          points={chartPoints}
          summary="Sample data: views rose from 1,200 to 17,200 over six days."
        />
      </Section>

      <Section
        title="Frosted card"
        note="Used only on the home hero and on campaign cards. Shown here over a flat placeholder."
      >
        <div className="rounded-card bg-line p-10">
          <FrostedCard className="-rotate-3 max-w-xs">
            <IconChip type="clipping" size={32} />
            <p className="font-display text-display-sm mt-4">Turn views into earnings.</p>
            <p className="mt-1 text-body-sm text-ink-2">Placeholder wording.</p>
          </FrostedCard>
        </div>
      </Section>

      <Section title="Dialog, drawer and toast">
        <Sample label="Dialog with one primary action at the bottom right">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Confirm withdrawal"
            description="Amount, fee and the total you receive are shown here before you confirm."
            actions={
              <>
                <Button variant="quiet" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  forward
                  onClick={() => {
                    setDialogOpen(false)
                    toast('Withdrawal requested')
                  }}
                >
                  Confirm
                </Button>
              </>
            }
          />
        </Sample>
        <Sample label="Drawer, 560px wide">
          <Drawer
            title="Submission detail"
            description="Summary, view chart, checks and history."
            trigger={<Button variant="secondary">Open drawer</Button>}
          >
            <DrawerSection title="Summary">
              <p className="text-body text-ink-2">Campaign, link, state and earnings.</p>
            </DrawerSection>
            <DrawerSection title="Views">
              <LineChart points={chartPoints} summary="Sample data for layout." />
            </DrawerSection>
            <DrawerSection title="Checks">
              <StatusDot tone="ok">Account verified</StatusDot>
            </DrawerSection>
          </Drawer>
        </Sample>
        <Sample label="Toast, black pill, gone after 4 seconds">
          <Button variant="secondary" onClick={() => toast('Link copied')}>
            Show toast
          </Button>
        </Sample>
      </Section>

      <Section title="Loading, empty, error and success" note="Every screen has all four.">
        <Sample label="Loading">
          <div className="w-full max-w-xl">
            <LoadingRows rows={3} />
          </div>
        </Sample>
        <Sample label="Skeleton blocks">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-64" />
        </Sample>
        <Sample label="Empty">
          <div className="w-full max-w-xl border-y border-line">
            <EmptyState
              message="No campaigns match these filters."
              action={
                <Button size="sm" variant="secondary">
                  Clear filters
                </Button>
              }
            />
          </div>
        </Sample>
        <Sample label="Error">
          <div className="w-full max-w-xl border-y border-line">
            <ErrorState
              action={
                <Button size="sm" variant="secondary">
                  Try again
                </Button>
              }
            />
          </div>
        </Sample>
        <Sample label="Success">
          <SuccessNote>Your post was submitted and the checks passed.</SuccessNote>
        </Sample>
        <Sample label="Search field pattern">
          <div className="relative w-full max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-[46px] text-ink-2"
            />
            <Input label="Search campaigns" className="pl-11" placeholder="Search" />
          </div>
        </Sample>
      </Section>
    </PageContainer>
  )
}

export function Styleguide() {
  return (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  )
}
