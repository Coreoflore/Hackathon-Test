export default function SessionHistory({ items, onOpen }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="pb-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Workspace History</span>
          <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Recent Interview Reports</h2>
          <p className="mt-1 text-xs text-slate-500">Reopen or review previous candidate evaluation reports stored locally.</p>
        </div>
        <p className="text-2xs text-slate-500 font-medium bg-slate-900 border border-white/5 rounded-full px-3 py-1 font-mono">
          Local Storage Session Cache
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const score = item.report?.answer_quality?.substantive_count;
          const total = item.report?.answer_quality?.answered_count;
          const level = item.report?.recommended_level || 'Needs Review';
          const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Saved report';

          return (
            <button
              key={item.sessionId}
              type="button"
              onClick={() => onOpen(item)}
              className="group relative flex flex-col justify-between rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.035] to-transparent p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:bg-cyan-500/[0.015] hover:shadow-[0_8px_30px_rgba(6,182,212,0.04)]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate rounded-md bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
                    {item.targetRole || 'Engineer'}
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-mono transition-colors">
                    {dateStr}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-200 transition-colors group-hover:text-white leading-snug">
                  {level}
                </h3>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                <span className="text-2xs text-slate-500 font-medium">Evaluation Verdict</span>
                {total ? (
                  <span className="text-2xs font-semibold text-emerald-400">
                    {score} of {total} Verified
                  </span>
                ) : (
                  <span className="text-2xs font-semibold text-cyan-300">
                    Report Loaded
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
