// Onboarding questions and client email templates, one set per offer.
//
// This is the only file to edit to change wording, add or remove a question,
// or change the welcome and confirmation emails. The client form and the
// server checks are both built from it.
//
// Offers: clipping (clipping campaign), coaching (1-on-1 coaching), consulting.
// Every link shows the `shared` questions first, then its offer's questions.
//
// A question:
//   id        stable id; answers are stored under it, so never reuse or rename
//             one that has been answered (add a new one instead)
//   offer     'shared' | 'clipping' | 'coaching' | 'consulting'
//   order     position within its offer (shared first, then the offer)
//   section   the name shown at the top of the form while it's on screen
//   label     the question as the client sees it
//   help      optional line under the question
//   type      text | email | phone | url | number | long | country | timezone
//             single | multi | dates | file_or_link | text_or_file | links | numbers | text_and_link
//   required  true | false
//   options   for single and multi: [{ value, label }] (value is what's stored)
//   none      for multi: the value that clears the others when picked
//   fields    for links and numbers: [{ key, label, placeholder }]
//   atLeastOne for links: true means one field must be filled (all optional on their own)
//   showIf    { id, equals }: only shown, and only required, when that answer equals the value
//   placeholder  optional hint inside the field
//
// Client-facing text must not use em dashes.

export const OFFERS = [
  { id: 'clipping', label: 'Clipping campaign', section: 'Your campaign' },
  { id: 'coaching', label: '1-on-1 coaching', section: 'Your coaching' },
  { id: 'consulting', label: 'Consulting', section: 'Your business' },
];

export const QUESTIONS = [
  // ---- Shared (every offer) ----
  { id: 'full_name', offer: 'shared', order: 1, section: 'About you', label: 'Full name', type: 'text', required: true },
  { id: 'business_name', offer: 'shared', order: 2, section: 'About you', label: 'Business or artist name', type: 'text', required: true },
  { id: 'email', offer: 'shared', order: 3, section: 'About you', label: 'Email', type: 'email', required: true, placeholder: 'you@company.com' },
  { id: 'whatsapp', offer: 'shared', order: 4, section: 'About you', label: 'WhatsApp number', help: 'Include the country code, for example +44 7700 900123.', type: 'phone', required: true, placeholder: '+44 7700 900123' },
  { id: 'country', offer: 'shared', order: 5, section: 'About you', label: 'Country', type: 'country', required: true },
  { id: 'timezone', offer: 'shared', order: 6, section: 'About you', label: 'Time zone', type: 'timezone', required: true },
  { id: 'invoice_details', offer: 'shared', order: 7, section: 'About you', label: 'Invoice details: legal name, address, and VAT or company number if you have one', type: 'long', required: true },
  {
    id: 'contact_method', offer: 'shared', order: 8, section: 'About you', label: 'Best way to reach you', type: 'single', required: true,
    options: [{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'instagram', label: 'Instagram DM' }, { value: 'email', label: 'Email' }],
  },

  // ---- Clipping ----
  {
    id: 'promoting', offer: 'clipping', order: 1, section: 'Your campaign', label: 'What are we promoting?', type: 'single', required: true,
    options: [{ value: 'song', label: 'A song' }, { value: 'product', label: 'A product' }, { value: 'brand', label: 'A brand' }, { value: 'person', label: 'A person' }],
  },
  { id: 'spotify_link', offer: 'clipping', order: 2, section: 'Your campaign', label: 'Spotify track link', type: 'url', required: true, showIf: { id: 'promoting', equals: 'song' }, placeholder: 'https://open.spotify.com/track/...' },
  { id: 'tiktok_sound', offer: 'clipping', order: 3, section: 'Your campaign', label: 'TikTok sound link', type: 'url', required: false, showIf: { id: 'promoting', equals: 'song' }, placeholder: 'https://www.tiktok.com/music/...' },
  { id: 'instagram_sound', offer: 'clipping', order: 4, section: 'Your campaign', label: 'Instagram sound link', type: 'url', required: false, showIf: { id: 'promoting', equals: 'song' }, placeholder: 'https://www.instagram.com/reels/audio/...' },
  { id: 'target_countries', offer: 'clipping', order: 5, section: 'Your campaign', label: 'Target countries', type: 'text', required: true, placeholder: 'For example UK, US, Nigeria' },
  {
    id: 'main_goal', offer: 'clipping', order: 6, section: 'Your campaign', label: 'Main goal', type: 'single', required: true,
    options: [{ value: 'awareness', label: 'Awareness' }, { value: 'shares', label: 'Shares' }, { value: 'streams', label: 'Streams' }, { value: 'signups', label: 'Sign-ups' }, { value: 'sales', label: 'Sales' }],
  },
  { id: 'key_dates', offer: 'clipping', order: 7, section: 'Your campaign', label: 'Key dates, for example a release, show or launch', type: 'dates', required: false },
  { id: 'raw_content', offer: 'clipping', order: 8, section: 'Your campaign', label: 'Link to the raw content we can clip, Drive or Dropbox', type: 'url', required: true, placeholder: 'https://drive.google.com/...' },
  { id: 'clipper_rules', offer: 'clipping', order: 9, section: 'Your campaign', label: 'Anything clippers must not do or say', type: 'long', required: false },
  { id: 'stream_stats', offer: 'clipping', order: 10, section: 'Your campaign', label: 'Your daily streams and monthly listeners for the 2 to 4 weeks before launch', help: 'Type them in, or upload screenshots.', type: 'text_or_file', required: false, showIf: { id: 'promoting', equals: 'song' } },

  // ---- Coaching ----
  { id: 'building', offer: 'coaching', order: 1, section: 'Your coaching', label: 'What are you building, and who is it for?', type: 'long', required: true },
  {
    id: 'social_links', offer: 'coaching', order: 2, section: 'Your coaching', label: 'Your links: Instagram, TikTok, YouTube, LinkedIn', help: 'Add at least one.', type: 'links', required: true, atLeastOne: true,
    fields: [
      { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
      { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
      { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@...' },
      { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
    ],
  },
  { id: 'analytics_recording', offer: 'coaching', order: 3, section: 'Your coaching', label: 'Screen recording of the analytics of your top 3 to 5 posts, going through every tab', help: 'Upload the video, or paste a link to it.', type: 'file_or_link', required: true },
  { id: 'hours_per_week', offer: 'coaching', order: 4, section: 'Your coaching', label: 'How many hours a week can you put in?', type: 'number', required: true },
  { id: 'video_target', offer: 'coaching', order: 5, section: 'Your coaching', label: 'How many videos a day or week are you aiming for?', type: 'text', required: true },
  {
    id: 'on_camera', offer: 'coaching', order: 6, section: 'Your coaching', label: 'Are you comfortable on camera?', type: 'single', required: true,
    options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'not_yet', label: 'Not yet' }],
  },
  { id: 'target_countries', offer: 'coaching', order: 7, section: 'Your coaching', label: 'Target countries', type: 'text', required: true, placeholder: 'For example UK, US, Nigeria' },
  { id: 'tried_so_far', offer: 'coaching', order: 8, section: 'Your coaching', label: 'What have you tried so far, and what didn’t work?', type: 'long', required: true },
  { id: 'goal_3_months', offer: 'coaching', order: 9, section: 'Your coaching', label: 'Your goal for the next 3 months, as one number', type: 'text', required: true, placeholder: 'For example 10,000 followers' },
  {
    id: 'already_have', offer: 'coaching', order: 10, section: 'Your coaching', label: 'Do you already have any of these?', type: 'multi', required: true, none: 'none',
    options: [{ value: 'offer', label: 'An offer' }, { value: 'lead_magnet', label: 'A lead magnet' }, { value: 'website', label: 'A website' }, { value: 'funnel', label: 'A funnel' }, { value: 'none', label: 'None yet' }],
  },

  // ---- Consulting ----
  { id: 'what_you_sell', offer: 'consulting', order: 1, section: 'Your business', label: 'What do you sell, at what price, and how is it sold today?', type: 'long', required: true },
  {
    id: 'monthly_numbers', offer: 'consulting', order: 2, section: 'Your business', label: 'Your current numbers per month: leads, calls, closes', type: 'numbers', required: true,
    fields: [{ key: 'leads', label: 'Leads' }, { key: 'calls', label: 'Calls' }, { key: 'closes', label: 'Closes' }],
  },
  { id: 'sales_tracking', offer: 'consulting', order: 3, section: 'Your business', label: 'Access to whatever tracks your sales, for example a CRM, spreadsheet or dashboard', help: 'Tell us how to get access, and add a link if there is one.', type: 'text_and_link', required: true },
  { id: 'bottleneck', offer: 'consulting', order: 4, section: 'Your business', label: 'Your biggest bottleneck right now', type: 'long', required: true },
];

// Questions for one offer, in the order the client sees them.
export function questionsFor(offer) {
  const shared = QUESTIONS.filter((q) => q.offer === 'shared').sort((a, b) => a.order - b.order);
  const own = QUESTIONS.filter((q) => q.offer === offer).sort((a, b) => a.order - b.order);
  return shared.concat(own);
}

// ---- Client emails, one template per offer ---------------------------------
// Placeholders: {first_name} {business_name} {campaign} {offer}. A line that is
// exactly {button} becomes the button: the form link in the welcome email, the
// booking link in the confirmation. {no_booking} lines only appear when the
// offer has no booking link set; {has_booking} lines only when it has one.
// `short` is the version for WhatsApp or DMs ({link} = the same link as the button).
const SIGN = ['Kind regards,', 'Jacques', 'Founder, Maison d’Élites'];

export const EMAILS = {
  welcome: {
    clipping: {
      subject: 'Welcome to Maison d’Élites, {first_name}',
      button: 'Open the onboarding form',
      body: [
        'Hi {first_name},',
        'Thank you for your payment, and for trusting us with {campaign}. I know choosing who to work with is a real decision, and I don’t take it lightly.',
        'The next step is a short onboarding form. It tells us everything we need to set the campaign up properly: what we’re promoting, the content clippers can use, and anything they must avoid. At the end you can book your onboarding call.',
        '{button}',
        'If anything comes up at any point, just reply here. You will always get a straight answer from us.',
        ...SIGN,
      ],
      short: 'Hi {first_name}, thank you for trusting us with {campaign}. Next step is a short onboarding form, and you can book your onboarding call at the end: {link}',
    },
    coaching: {
      subject: 'Welcome to your coaching, {first_name}',
      button: 'Open the onboarding form',
      body: [
        'Hi {first_name},',
        'Thank you for your payment, and welcome. I’m looking forward to working with you one on one.',
        'Before our first call, please fill in the onboarding form. It covers what you’re building, your links and analytics, and your goal for the next 3 months, so we can spend the call on the plan rather than the basics. At the end you can book the call.',
        '{button}',
        'If anything comes up, just reply here.',
        ...SIGN,
      ],
      short: 'Hi {first_name}, welcome to your coaching. Please fill in the onboarding form before our first call, you can book the call at the end: {link}',
    },
    consulting: {
      subject: 'Welcome to Maison d’Élites, {first_name}',
      button: 'Open the onboarding form',
      body: [
        'Hi {first_name},',
        'Thank you for your payment, and for trusting us with {business_name}.',
        'Before our first call, please fill in the onboarding form. It covers what you sell, your current numbers and your biggest bottleneck, so we can get straight to the work. At the end you can book the call.',
        '{button}',
        'If anything comes up, just reply here.',
        ...SIGN,
      ],
      short: 'Hi {first_name}, thank you for trusting us with {business_name}. Please fill in the onboarding form before our first call, you can book it at the end: {link}',
    },
  },
  submitted: {
    clipping: {
      subject: 'We’ve received your campaign details',
      button: 'Book your onboarding call',
      body: [
        'Hi {first_name},',
        'Thank you for completing your onboarding. Our team is now reviewing your answers.',
        '{has_booking}If you haven’t booked your onboarding call yet, you can pick a time here:',
        '{button}',
        '{no_booking}We’ll be in touch within 24 hours to book your onboarding call.',
        'Once your campaign is live, you’ll receive a link to your live campaign report, which updates automatically.',
        ...SIGN,
      ],
    },
    coaching: {
      subject: 'We’ve received your onboarding form',
      button: 'Book your onboarding call',
      body: [
        'Hi {first_name},',
        'Thank you for completing your onboarding. I’ll go through your answers before our first call.',
        '{has_booking}If you haven’t booked the call yet, you can pick a time here:',
        '{button}',
        '{no_booking}We’ll be in touch within 24 hours to book your onboarding call.',
        ...SIGN,
      ],
    },
    consulting: {
      subject: 'We’ve received your onboarding form',
      button: 'Book your onboarding call',
      body: [
        'Hi {first_name},',
        'Thank you for completing your onboarding. We’ll go through your answers before our first call.',
        '{has_booking}If you haven’t booked the call yet, you can pick a time here:',
        '{button}',
        '{no_booking}We’ll be in touch within 24 hours to book your onboarding call.',
        ...SIGN,
      ],
    },
  },
};

// Countries for the country question (shown in this order).
export const COUNTRIES = ['United Kingdom', 'United States', 'Belgium', 'Netherlands', 'France', 'Germany', 'Ireland', 'Nigeria', 'Ghana', 'Canada', 'Australia',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia',
  'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia',
  'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'Gabon', 'Gambia', 'Georgia', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
  'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia',
  'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
  'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'New Zealand', 'Nicaragua', 'Niger', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Puerto Rico', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan',
  'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'];
