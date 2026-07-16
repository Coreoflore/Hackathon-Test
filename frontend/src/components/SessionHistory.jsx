export default function SessionHistory({ items, onOpen }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl pb-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-200">Your workspace</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Recent interview reports</h2>
        </div>
        <p className="text-xs text-slate-600">Stored in this browser</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button key={item.sessionId} type="button" onClick={() => onOpen(item)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.targetRole || 'Interview report'}</p>
            <p className="mt-3 font-medium text-white">{item.report?.recommended_level || 'Needs further review'}</p>
            <p className="mt-2 text-xs text-slate-600">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Saved report'}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
