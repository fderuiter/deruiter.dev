export default function Loading() {
  return (
    <div className="min-h-screen py-24 px-6 md:px-16 flex flex-col items-center bg-brand-dark text-foreground">
      {/* Main Container */}
      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center">
        {/* Title Block Pulse */}
        <div className="w-48 h-10 bg-neutral-900 animate-pulse rounded-xl mb-4" />
        <div className="w-64 h-4 bg-neutral-900 animate-pulse rounded-md mb-12" />

        {/* Database Status Alert Pulse */}
        <div className="w-full h-12 bg-neutral-900/60 animate-pulse rounded-2xl mb-12" />

        {/* Feed Columns Pulse (3 skeletons) */}
        <div className="w-full space-y-6">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="p-6 bg-neutral-950/20 border border-neutral-900 rounded-2xl overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-40 h-6 bg-neutral-900 animate-pulse rounded-lg" />
                <div className="w-16 h-5 bg-neutral-900 animate-pulse rounded" />
              </div>
              <div className="space-y-2.5 mb-6">
                <div className="w-full h-4 bg-neutral-900/60 animate-pulse rounded" />
                <div className="w-5/6 h-4 bg-neutral-900/60 animate-pulse rounded" />
              </div>
              <div className="flex gap-2">
                <div className="w-14 h-5 bg-neutral-900/50 animate-pulse rounded" />
                <div className="w-14 h-5 bg-neutral-900/50 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
