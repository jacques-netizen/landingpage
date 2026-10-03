/** Starting reason codes from docs/03_SYSTEMS.md section 5. Admins can edit the wording. */
export type ReasonCodeSeed = {
  code: string
  label: string
  appliesTo: ('submission' | 'removal' | 'warning')[]
  creatorMessage: string
}

const s = (code: string, label: string, creatorMessage: string): ReasonCodeSeed => ({
  code,
  label,
  appliesTo: ['submission', 'removal', 'warning'],
  creatorMessage,
})

export const reasonCodeSeeds: ReasonCodeSeed[] = [
  s(
    'not_linked_account',
    'Not a linked account',
    'This post is not from one of your verified accounts.',
  ),
  s('posted_before_start', 'Posted before start', 'This post went up before the campaign opened.'),
  s(
    'posted_too_early',
    'Posted too long ago',
    'Posts must be submitted within 24 hours of publishing.',
  ),
  s('posted_after_end', 'Posted after end', 'The campaign had already closed.'),
  s('private_or_hidden_stats', 'Private or hidden stats', 'The post or its stats are not public.'),
  s('duplicate_post', 'Duplicate post', 'This post is already in the campaign.'),
  s('wrong_platform', 'Wrong platform', 'This platform is not allowed in this campaign.'),
  s('below_min_duration', 'Below minimum duration', 'The video is shorter than the minimum.'),
  s('missing_hashtag', 'Missing hashtag', 'A required hashtag is missing.'),
  s('missing_disclosure', 'Missing disclosure', 'The post needs a clear ad disclosure.'),
  s('missing_logo', 'Missing logo', 'The logo is not visible as the rules require.'),
  s('missing_audio', 'Missing audio', 'The required sound is not used as the rules require.'),
  s('account_too_new', 'Account too new', 'The account is newer than the campaign allows.'),
  s(
    'account_below_followers',
    'Below follower minimum',
    'The account has fewer followers than the campaign requires.',
  ),
  s('region_mismatch', 'Region mismatch', 'The audience is outside the allowed regions.'),
  s('low_engagement', 'Low engagement', 'Engagement is below the campaign minimum.'),
  s('suspected_view_inflation', 'Suspected view inflation', 'The views look artificial.'),
  s('not_original', 'Not original', 'The content is not original.'),
  s('brand_unsafe', 'Brand unsafe', 'The content breaks the content rules.'),
  s('deleted_or_edited_post', 'Deleted or edited', 'The post was removed or changed.'),
  s('other', 'Other', 'See the note from the reviewer.'),
]
