import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70">
        <div className="shell flex h-14 items-center justify-between">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </header>

      <main className="shell space-y-6 py-8">
        <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <div className="flex gap-6">
            <Skeleton className="size-20 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-full max-w-lg" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>

        <Skeleton className="h-96 rounded-2xl" />
      </main>
    </div>
  );
}
