'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
    content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-gray-900 mt-8 mb-4 first:mt-0">{children}</h1>
                ),
                h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">{children}</h2>
                ),
                h3: ({ children }) => (
                    <h3 className="text-lg font-semibold text-gray-800 mt-5 mb-2">{children}</h3>
                ),
                p: ({ children }) => (
                    <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
                ),
                ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700 pl-4">{children}</ul>
                ),
                ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-4 text-gray-700 pl-4">{children}</ol>
                ),
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                a: ({ href, children }) => (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 underline hover:text-amber-700 transition-colors"
                    >
                        {children}
                    </a>
                ),
                blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-amber-400 pl-4 italic text-gray-600 my-4">
                        {children}
                    </blockquote>
                ),
                hr: () => <hr className="border-gray-200 my-6" />,
                table: ({ children }) => (
                    <div className="overflow-x-auto mb-4">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                            {children}
                        </table>
                    </div>
                ),
                th: ({ children }) => (
                    <th className="px-4 py-2 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {children}
                    </th>
                ),
                td: ({ children }) => (
                    <td className="px-4 py-2 text-sm text-gray-700 border-t border-gray-100">{children}</td>
                ),
                code: ({ children, className }) => {
                    const isBlock = className?.includes('language-');
                    return isBlock ? (
                        <pre className="bg-gray-100 rounded-lg p-4 overflow-x-auto mb-4 text-sm font-mono text-gray-800">
                            <code>{children}</code>
                        </pre>
                    ) : (
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">
                            {children}
                        </code>
                    );
                },
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
