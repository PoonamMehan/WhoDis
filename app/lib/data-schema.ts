/**
 * Data Schema Reference — all 4 API endpoint response structures.
 * Used for RAG chunking and ProfileHeader field mapping.
 *
 * ═══════════════════════════════════════════════════════════
 * ENDPOINT 1: X Timeline  (twitter-api45/timeline.php)
 * ═══════════════════════════════════════════════════════════
 *
 * Top-level: { status, next_cursor, prev_cursor, user, pinned, timeline[] }
 *
 * user: {
 *   id, rest_id, name, desc, location, avatar, header_image,
 *   friends (following), sub_count (followers), statuses_count,
 *   media_count, created_at, blue_verified, protected
 * }
 *
 * timeline[]: {
 *   tweet_id, conversation_id, created_at, lang, source, text,
 *   views, favorites, bookmarks, quotes, replies, retweets,
 *   author: { rest_id, name, screen_name, avatar, followers_count, blue_verified },
 *   entities: { hashtags[], urls[], user_mentions[], media[] },
 *   media?: { photo[], video[] },
 *   quoted?: { ...tweet },
 *   retweeted?: { id }, retweeted_tweet?: { ...tweet }
 * }
 *
 * ═══════════════════════════════════════════════════════════
 * ENDPOINT 2: X Replies  (twitter-api45/replies.php)
 * ═══════════════════════════════════════════════════════════
 *
 * Top-level: { next_cursor, user, timeline[] }
 *
 * user: same as timeline endpoint
 *
 * timeline[]: same as timeline endpoint, plus:
 *   - in_reply_to_status_id_str (null if not a reply)
 *   - reply_to (shorthand parent tweet ID)
 *   - place?: { country, country_code, name, full_name, place_type }
 *   - author also has favourites_count
 *
 * ═══════════════════════════════════════════════════════════
 * ENDPOINT 3: LinkedIn Profile  (BrightData gd_l1viktl72bvl7bjuj0)
 * ═══════════════════════════════════════════════════════════
 *
 * Top-level (single object, or array[0]):
 * {
 *   id (handle/slug), name, first_name, last_name,
 *   city, location, country_code, about (bio),
 *   url, avatar, banner_image, influencer,
 *   current_company: { link, name, company_id, location },
 *   experience: [...] | null,
 *   education: [{ title, url, start_year, end_year, description }],
 *   educations_details (plain text summary),
 *   certifications: [{ title, subtitle, meta, credential_url }],
 *   courses: [{ title, subtitle }],
 *   organizations: [{ title, membership_type, start_date, end_date, description }],
 *   honors_and_awards,
 *   activity: [{ interaction, link, title, img, id }],
 *   people_also_viewed: [{ profile_link, name, about, location }],
 *   similar_profiles, bio_links
 * }
 *
 * ═══════════════════════════════════════════════════════════
 * ENDPOINT 4: LinkedIn Posts  (BrightData gd_lyy3tktm25m4avu764)
 * ═══════════════════════════════════════════════════════════
 *
 * Top-level: array of post objects
 *
 * post: {
 *   url, id, user_id, title, headline, post_text (plain text),
 *   date_posted (ISO 8601), hashtags[], embedded_links[],
 *   images[], videos[], num_likes, num_comments,
 *   post_type, account_type,
 *   top_visible_comments: [{
 *     user_id, user_name, comment_date, comment,
 *     num_reactions, user_title, tagged_users
 *   }],
 *   tagged_companies[], tagged_people: [{ name, link }],
 *   user_followers, user_posts, user_articles,
 *   user_title, author_profile_pic,
 *   post_text_html, original_post_text (raw HTML),
 *   repost: { repost_hangtags, repost_attachments, tagged_users, tagged_companies }
 * }
 *
 * ═══════════════════════════════════════════════════════════
 * UNIFIED profileData STRUCTURE (as stored in Redux)
 * ═══════════════════════════════════════════════════════════
 *
 * Twitter:
 * {
 *   ...timelineResponse,        // status, user, timeline[], pinned
 *   replies: repliesResponse,   // { user, timeline[] } from replies endpoint
 *   _source: "twitter"
 * }
 *
 * LinkedIn:
 * {
 *   ...profileResponse,         // name, id, about, education, etc.
 *   posts: postsArray,          // array of post objects (up to 20)
 *   _source: "linkedin"
 * }
 */

export type DataSource = "twitter" | "linkedin";
