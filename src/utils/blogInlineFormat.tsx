import React from 'react';

const INLINE_TOKEN_REGEX =
  /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)|`[^`]+`|\*(?!\s)[^*\n]+?(?<!\s)\*)/g;

/**
 * Safely renders inline Markdown formatting (**bold**, __bold__, *italic*, `code`, [links](url))
 * into React nodes without dangerouslySetInnerHTML.
 */
export function renderBlogInlineText(text: string): React.ReactNode {
  const input = String(text || '');
  if (!input) return null;

  const parts = input.split(INLINE_TOKEN_REGEX);
  return parts.map((part, idx) => {
    if (!part) return null;

    // **bold** or __bold__
    if (
      ((part.startsWith('**') && part.endsWith('**')) ||
        (part.startsWith('__') && part.endsWith('__'))) &&
      part.length > 4
    ) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-bold text-[#0F2E52]">
          {renderBlogInlineText(inner)}
        </strong>
      );
    }

    // [label](url)
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const linkMatch = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        return (
          <a
            key={idx}
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="text-[#0F2E52] font-semibold underline underline-offset-2 hover:text-blue-700"
          >
            {label}
          </a>
        );
      }
    }

    // `code` or `https://...`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const inner = part.slice(1, -1);
      if (inner.startsWith('https://') || inner.startsWith('http://')) {
        return (
          <a
            key={idx}
            href={inner}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-blue-700 underline underline-offset-2 break-all"
          >
            {inner}
          </a>
        );
      }
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[0.9em] font-mono text-[#0F2E52]"
        >
          {inner}
        </code>
      );
    }

    // *italic*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
