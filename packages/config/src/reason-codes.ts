// Starting reason codes from 03_SYSTEMS.md section 5, plus post_limit_reached for check 5 of section 4. Admins can edit the wording later in the reason_codes table.
export const REASON_CODES = [
  ['not_linked_account', 'Not a linked account', 'This post is not from one of your verified accounts.'],
  ['posted_before_start', 'Posted before start', 'This post went up before the campaign opened.'],
  ['posted_too_early', 'Submitted too late', 'Posts must be submitted within 24 hours of publishing.'],
  ['posted_after_end', 'Posted after end', 'The campaign had already closed.'],
  ['private_or_hidden_stats', 'Private or hidden stats', 'The post or its stats are not public.'],
  ['duplicate_post', 'Duplicate post', 'This post is already in the campaign.'],
  ['wrong_platform', 'Wrong platform', 'This platform is not allowed in this campaign.'],
  ['below_min_duration', 'Below minimum duration', 'The video is shorter than the minimum.'],
  ['missing_hashtag', 'Missing hashtag', 'A required hashtag is missing.'],
  ['missing_disclosure', 'Missing disclosure', 'The post needs a clear ad disclosure.'],
  ['missing_logo', 'Missing logo', 'The logo is not visible as the rules require.'],
  ['missing_audio', 'Missing audio', 'The required sound is not used as the rules require.'],
  ['account_too_new', 'Account too new', 'The account is newer than the campaign allows.'],
  ['account_below_followers', 'Below follower minimum', 'The account has fewer followers than the campaign requires.'],
  ['region_mismatch', 'Region mismatch', 'The audience is outside the allowed regions.'],
  ['low_engagement', 'Low engagement', 'Engagement is below the campaign minimum.'],
  ['suspected_view_inflation', 'Suspected view inflation', 'The views look artificial.'],
  ['not_original', 'Not original', 'The content is not original.'],
  ['brand_unsafe', 'Brand unsafe', 'The content breaks the content rules.'],
  ['deleted_or_edited_post', 'Deleted or edited post', 'The post was removed or changed.'],
  ['post_limit_reached', 'Post limit reached', 'This account has already submitted the most posts this campaign allows.'],
  ['other', 'Other', 'See the note from the reviewer.'],
] as const

export type ReasonCode = (typeof REASON_CODES)[number][0]
