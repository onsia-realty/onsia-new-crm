export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-14 border-b bg-white" />
      <main className="mx-auto w-full max-w-screen-sm px-3 pt-3">
        <div className="mb-3 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-full bg-gray-200"
            />
          ))}
        </div>
        <ul className="space-y-2">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white"
            />
          ))}
        </ul>
      </main>
    </div>
  );
}
