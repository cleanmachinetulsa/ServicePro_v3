import { Skeleton } from '@/components/ui/skeleton';

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar Skeleton */}
      <aside className="hidden lg:flex lg:w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>

        <div className="flex-1 py-4 px-2 space-y-2">
          <div className="px-2 mb-4">
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          
          {/* Navigation skeleton items */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1 max-w-[120px]" />
            </div>
          ))}
          
          <div className="my-4 px-3">
            <Skeleton className="h-px w-full" />
          </div>
          
          {[...Array(4)].map((_, i) => (
            <div key={`sec2-${i}`} className="px-3 py-2 flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1 max-w-[100px]" />
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <Skeleton className="h-3 w-24 mb-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Bar Skeleton */}
        <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 p-4 min-h-14">
            {/* Hamburger placeholder for mobile */}
            <div className="lg:hidden">
              <Skeleton className="h-10 w-10 rounded" />
            </div>
            
            {/* Title skeleton */}
            <Skeleton className="h-6 w-32" />
            
            {/* Search skeleton */}
            <div className="flex-1 max-w-md hidden sm:block">
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            
            <div className="flex-1" />
            
            {/* Action buttons skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded" />
              <Skeleton className="h-9 w-9 rounded" />
            </div>
          </div>
        </header>

        {/* Main Content Skeleton */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats row skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
            
            {/* Main content cards skeleton */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
                <Skeleton className="h-5 w-32 mb-4" />
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
                <Skeleton className="h-5 w-28 mb-4" />
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NightOpsMessagesPageSkeleton() {
  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-950 via-slate-950 to-black flex flex-col">
      {/* Header skeleton */}
      <header className="flex-shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-2xl bg-slate-800" />
            <div>
              <Skeleton className="h-3 w-20 mb-1 bg-slate-800" />
              <Skeleton className="h-4 w-32 bg-slate-800" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded bg-slate-800" />
            <Skeleton className="h-8 w-16 rounded bg-slate-800" />
          </div>
        </div>
      </header>

      {/* 3-column layout skeleton */}
      <main className="flex-1 hidden lg:flex gap-4 px-6 py-4 overflow-hidden">
        {/* Inbox column */}
        <div className="w-[26%] min-w-[280px] rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col">
          <div className="p-4 border-b border-slate-700/60">
            <Skeleton className="h-5 w-16 mb-2 bg-slate-800" />
            <Skeleton className="h-3 w-24 bg-slate-800" />
          </div>
          <div className="flex-1 p-3 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-800/40 flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-700" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1 bg-slate-700" />
                  <Skeleton className="h-3 w-32 bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thread column */}
        <div className="flex-1 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col">
          <div className="p-4 border-b border-slate-700/60">
            <Skeleton className="h-5 w-16 bg-slate-800" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4 bg-slate-800" />
              <Skeleton className="h-5 w-40 mx-auto mb-2 bg-slate-800" />
              <Skeleton className="h-4 w-56 mx-auto bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Context column */}
        <div className="w-[28%] min-w-[280px] rounded-2xl bg-slate-900/60 border border-slate-800/60 flex flex-col">
          <div className="p-4 border-b border-slate-700/60">
            <Skeleton className="h-5 w-16 mb-2 bg-slate-800" />
            <Skeleton className="h-3 w-32 bg-slate-800" />
          </div>
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-24 w-full rounded-lg bg-slate-800" />
            <Skeleton className="h-16 w-full rounded-lg bg-slate-800" />
            <Skeleton className="h-20 w-full rounded-lg bg-slate-800" />
          </div>
        </div>
      </main>

      {/* Mobile skeleton */}
      <div className="flex-1 lg:hidden p-3 space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-3 rounded-xl bg-slate-800/40 flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full bg-slate-700" />
            <div className="flex-1">
              <Skeleton className="h-4 w-28 mb-1 bg-slate-700" />
              <Skeleton className="h-3 w-40 bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhonePageSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Tabs skeleton */}
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-4 py-2">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-4 gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* Dialer skeleton */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-6">
          <Skeleton className="h-14 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-14 rounded-full mx-auto" />
            ))}
          </div>
          <Skeleton className="h-14 w-14 rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
}
