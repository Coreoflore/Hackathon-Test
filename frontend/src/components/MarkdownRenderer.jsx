import React from 'react';

export default function MarkdownRenderer({ text, className = '' }) {
  if (typeof text !== 'string') return null;

  // Split by code blocks: ```[language]\n[content]```
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`markdown-body leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        // If it's a code block
        if (part.startsWith('```')) {
          const lines = part.split('\n');
          const firstLine = lines[0] || '```';
          const lang = firstLine.replace('```', '').trim();
          
          const codeLines = lines.slice(1);
          if (codeLines[codeLines.length - 1]?.trim() === '```') {
            codeLines.pop();
          }
          const codeContent = codeLines.join('\n');

          return (
            <div key={index} className="my-3 overflow-hidden rounded-xl border border-white/5 bg-slate-950/80 shadow-inner">
              {lang && (
                <div className="flex items-center justify-between border-b border-white/5 bg-slate-950/40 px-4 py-2 text-2xs font-mono text-slate-500 uppercase tracking-wider select-none">
                  <span>{lang}</span>
                  <span className="text-[10px] text-slate-600">code block</span>
                </div>
              )}
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-cyan-200/90 whitespace-pre">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        // Process inline formatting (bold, italic, inline code)
        // Split by inline code: `code`
        const inlineParts = part.split(/(`[^`\n]+`)/g);

        return (
          <span key={index}>
            {inlineParts.map((subPart, subIndex) => {
              if (subPart.startsWith('`') && subPart.endsWith('`')) {
                const codeText = subPart.slice(1, -1);
                return (
                  <code key={subIndex} className="mx-1 rounded border border-white/5 bg-slate-950/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-cyan-300">
                    {codeText}
                  </code>
                );
              }

              // Process bold: **text**
              const boldParts = subPart.split(/(\*\*[^*]+\*\*)/g);
              return (
                <span key={subIndex}>
                  {boldParts.map((boldPart, boldIndex) => {
                    if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                      const boldText = boldPart.slice(2, -2);
                      return <strong key={boldIndex} className="font-bold text-white">{boldText}</strong>;
                    }

                    // Process line breaks
                    return boldPart.split('\n').map((line, lineIndex, array) => (
                      <React.Fragment key={lineIndex}>
                        {line}
                        {lineIndex < array.length - 1 && <br />}
                      </React.Fragment>
                    ));
                  })}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
