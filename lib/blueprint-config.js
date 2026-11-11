// The Athlete Income Blueprint: Chris Bak's (Run It Bak) opt-in funnel.
// Every setting for /blueprint lives in this one file. Secrets never go here:
// they are Worker secrets (Cloudflare, Worker, Settings, Variables and Secrets),
// named in SECRET_NAMES below.
//
// Pages:  /blueprint          opt-in (two steps: name, then email and WhatsApp)
//         /blueprint/thanks   thank-you page
//         /blueprint/leads    private list of sign-ups (ADMIN_PASSWORD)
// API:    POST /api/blueprint/lead      the form posts here
//         GET  /api/blueprint/config    public settings the pages read
//         GET  /api/blueprint/leads     sign-ups as JSON, or ?format=csv (Bearer ADMIN_PASSWORD)

export const BLUEPRINT = {
  // Lead magnet. The email sends this link. Check the Drive file is shared as
  // "Anyone with the link can view" before going live.
  leadMagnetName: 'The Athlete Income Blueprint',
  leadMagnetUrl: 'https://drive.google.com/file/d/1zkS2u872jFV-KDk33zu-_EgvscOlgIV_/view?usp=sharing',

  // Chris's Instagram. The thank-you page and the email link to his DMs.
  instagramHandle: 'chris_bak0',
  instagramDmUrl: 'https://ig.me/m/chris_bak0',

  // Thank-you page video: an 11 character YouTube id. Empty hides the video.
  thanksYoutubeId: '',

  // Phone field default country code (the lead can change it).
  defaultCountryCode: '+44',

  // Delivery email. The sender domain must be verified in Resend.
  // PLACEHOLDER: replace with Chris's verified sender, e.g. 'Chris Bak <chris@runitbak.com>'.
  emailFrom: 'Chris Bak <REPLACE_WITH_VERIFIED_SENDER@example.com>',
  // PLACEHOLDER: where replies to the email go (Chris's inbox).
  emailReplyTo: 'REPLACE_WITH_CHRIS_INBOX@example.com',
  emailSubject: 'Your Athlete Income Blueprint',

  // ManyChat. The DM button opens /blueprint?mc={{contact id}}&src=ig-skill.
  // After the form, the contact gets this tag, so ManyChat knows they opted in.
  manychatTag: 'blueprint-optin',
  // Optional custom fields (create them in ManyChat first as Text fields, or leave empty).
  manychatEmailField: 'blueprint_email',
  manychatPhoneField: 'blueprint_phone',

  // Where sign-ups are stored in the MEDIA R2 bucket.
  storagePrefix: 'blueprint/leads/',

  // Consent text version, stored with each lead. Change it when the consent line changes.
  consentVersion: '2026-11-blueprint-1',
};

// Worker secrets and variables (values set in Cloudflare, never in the repo).
export const SECRET_NAMES = {
  resendKey: 'RESEND_API_KEY',               // already set for the main site
  manychatToken: 'BLUEPRINT_MANYCHAT_TOKEN', // Chris's ManyChat API token (Settings, API)
  notifyEmail: 'BLUEPRINT_NOTIFY_EMAIL',     // optional: inbox that gets a ping per sign-up
  discordWebhook: 'BLUEPRINT_DISCORD_WEBHOOK', // optional: channel that gets a ping per sign-up
  emailFrom: 'BLUEPRINT_FROM',               // optional: overrides emailFrom above
  admin: 'ADMIN_PASSWORD',                   // already set; opens /blueprint/leads
};

// What the pages may read (no secrets, no storage details).
export function publicConfig() {
  return {
    leadMagnetName: BLUEPRINT.leadMagnetName,
    instagramHandle: BLUEPRINT.instagramHandle,
    instagramDmUrl: BLUEPRINT.instagramDmUrl,
    thanksYoutubeId: BLUEPRINT.thanksYoutubeId,
    defaultCountryCode: BLUEPRINT.defaultCountryCode,
    consentVersion: BLUEPRINT.consentVersion,
  };
}
