"use client";

import Image from "next/image";

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProfile(profileData: unknown): any {
  if (!profileData || typeof profileData !== "object") return null;
  const data = profileData as Record<string, unknown>;
  const source = data._source as string | undefined;

  if (source === "linkedin") {
    return {
      source: "linkedin",
      displayName: data.name || null,
      handle: data.id || null,
      avatarUrl: (data.avatar as string) || null,
      bio: data.about || data.headline || null,
      location: data.city || data.country || null,
      followers: data.followers,
      following: data.connections,
      followersLabel: "Followers",
      followingLabel: "Connections",
      verified: false,
    };
  }

  // Twitter (default)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = "user" in data ? (data.user as any) : null;
  if (!user) return null;

  const rawAvatar = user.profile_image_url_https || user.profile_image_url || user.avatar || (data as any).avatar || null;
  const avatarUrl = rawAvatar
    ? (rawAvatar as string).replace(/_normal\./, "_400x400.")
    : null;

  return {
    source: "twitter",
    displayName: user.name || null,
    handle: user.screen_name ? `@${user.screen_name}` : null,
    avatarUrl,
    bio: user.description || null,
    location: user.location || null,
    followers: user.sub_count,
    following: user.friends,
    followersLabel: "Followers",
    followingLabel: "Following",
    verified: user.is_blue_verified || false,
  };
}

export default function ProfileHeader({ profileData }: { profileData: unknown }) {
  const profile = extractProfile(profileData);
  if (!profile) return null;

  return (
    <div className="profile-card px-6 py-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start gap-4">
          {/* Avatar with glow ring */}
          {profile.avatarUrl && (
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-[#6d28d9]/40 to-[#7c3aed]/20 blur-sm" />
              <Image
                src={profile.avatarUrl}
                alt={profile.displayName || "Profile"}
                width={52}
                height={52}
                className="relative rounded-full border border-[#27272a]"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {profile.displayName && (
                <span className="text-[15px] font-semibold text-[#fafafa] truncate">
                  {profile.displayName}
                </span>
              )}
              {profile.verified && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#7c3aed">
                  <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.88 13.43 2 12 2s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.88 9.33 2 10.57 2 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81C9.33 21.12 10.57 22 12 22s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91C21.12 14.67 22 13.43 22 12zm-11.07 4.83-3.07-3.07 1.06-1.06 2.01 2.01 4.61-4.61 1.06 1.06-5.67 5.67z" />
                </svg>
              )}
              {/* Source badge */}
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#27272a] text-[#71717a]">
                {profile.source}
              </span>
            </div>

            {profile.handle && (
              <span className="text-sm text-[#71717a] font-mono">
                {profile.handle}
              </span>
            )}

            {profile.bio && (
              <p className="text-sm text-[#a1a1aa] mt-1.5 line-clamp-2 leading-relaxed">
                {profile.bio}
              </p>
            )}

            {profile.location && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-[#52525b]">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {profile.location}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {profile.followers != null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded-lg">
              <span className="text-sm font-semibold text-[#fafafa] tabular-nums">
                {formatCount(Number(profile.followers))}
              </span>
              <span className="text-[11px] text-[#52525b] uppercase tracking-wider font-mono">{profile.followersLabel}</span>
            </div>
          )}
          {profile.following != null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded-lg">
              <span className="text-sm font-semibold text-[#fafafa] tabular-nums">
                {formatCount(Number(profile.following))}
              </span>
              <span className="text-[11px] text-[#52525b] uppercase tracking-wider font-mono">{profile.followingLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
