import ReactMarkdown from 'react-markdown';

export default function MarkdownRenderer({ text, className = '' }) {
  if (typeof text !== 'string') return null;

  return (
    <div className={`markdown-body leading-relaxed ${className}`}>
      <ReactMarkdown
        components={{
          code({ node, className: langClass, children, ...props }) {
            const match = /language-(\w+)/.exec(langClass || '');
            if (match) {
              return (
                <div className="my-3 overflow-hidden rounded-xl border border-white/5 bg-slate-950/80 shadow-inner">
                  <div className="flex items-center justify-between border-b border-white/5 bg-slate-950/40 px-4 py-2 text-2xs font-mono text-slate-500 uppercase tracking-wider select-none">
                    <span>{match[1]}</span>
                    <span className="text-[10px] text-slate-600">code block</span>
                  </div>
                  <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-cyan-200/90 whitespace-pre">
                    <code {...props}>{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="mx-1 rounded border border-white/5 bg-slate-950/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-cyan-300" {...props}>
                {children}
              </code>
            );
          },
          strong({ children }) {
            return <strong className="font-bold text-white">{children}</strong>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline decoration-cyan-300/30 underline-offset-2 hover:text-cyan-200 hover:decoration-cyan-200/50 transition-colors">
                {children}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-cyan-300/40 pl-3 text-sm leading-6 text-slate-400 italic">
                {children}
              </blockquote>
            );
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm leading-6 text-slate-300">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-semibold text-white mt-3 mb-2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold text-white mt-2 mb-1">{children}</h3>;
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

