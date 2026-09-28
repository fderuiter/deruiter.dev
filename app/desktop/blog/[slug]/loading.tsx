export default function BlogPostLoading() {
  return (
    <div className="min-h-screen py-24 px-6 md:px-16 bg-brand-dark text-foreground flex flex-col items-center">
      {/* Background Blurs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-brand-cyan/5 blur-[120px] pointer-events-none hidden sm:block" />

      <div className="relative z-10 w-full max-w-3xl">
        {/* Back Link Pulse */}
        <div className="w-32 h-4 bg-neutral-900 animate-pulse rounded-md mb-8" />

        {/* Title Pulse */}
        <div className="w-3/4 h-10 bg-neutral-900 animate-pulse rounded-xl mb-4" />

        {/* Dek Pulse */}
        <div className="flex gap-4 items-center mb-8">
          <div className="w-full h-5 bg-neutral-900 animate-pulse rounded" />
        </div>

        {/* Article Body Pulse Skeletons */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="w-full h-4 bg-neutral-900/60 animate-pulse rounded" />
            <div className="w-11/12 h-4 bg-neutral-900/60 animate-pulse rounded" />
            <div className="w-full h-4 bg-neutral-900/60 animate-pulse rounded" />
            <div className="w-4/5 h-4 bg-neutral-900/60 animate-pulse rounded" />
          </div>

          <div className="space-y-3">
            <div className="w-full h-4 bg-neutral-900/60 animate-pulse rounded" />
            <div className="w-full h-4 bg-neutral-900/60 animate-pulse rounded" />
            <div className="w-5/6 h-4 bg-neutral-900/60 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
