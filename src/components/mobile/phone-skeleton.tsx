/** Shown instantly when a phone screen is opened, while its data loads. */
export function PhoneSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading">
      {hero ? (
        <div className="hero-panel h-44 px-5 pt-11">
          <div className="size-10 rounded-full bg-white/10" />
          <div className="mt-6 h-6 w-2/3 animate-pulse rounded-lg bg-white/15" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded-lg bg-white/10" />
        </div>
      ) : (
        <div className="px-5 pt-12">
          <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
          <div className="mt-2 h-7 w-40 animate-pulse rounded-lg bg-surface-2" />
        </div>
      )}
      <div className="flex-1 space-y-3 px-5 pt-5">
        <div className="h-28 animate-pulse rounded-2xl bg-surface ring-1 ring-border" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface ring-1 ring-border" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface ring-1 ring-border" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface ring-1 ring-border" />
      </div>
      <div className="h-20 border-t border-border bg-surface" />
    </div>
  );
}
