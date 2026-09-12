/**
 * Read a document without leaving CozyVTT.
 *
 * A full-screen overlay with the document inside it, and a way to open the same
 * file in a new tab for anyone who would rather read on a second monitor while
 * play carries on. Both were asked for.
 *
 * How each format is shown decides what the browser is trusted with:
 *
 * - **PDF** goes in an <iframe> pointing at the document route, and the browser's
 *   own viewer renders it. The route serves it with a sandbox policy and
 *   sniffing disabled, so the frame has no origin to act in.
 * - **Markdown** is fetched as text and rendered here with react-markdown, which
 *   ignores raw HTML unless rehype-raw is added, and it is not. The server
 *   serves Markdown as text/plain on purpose, so even opened in a new tab it is
 *   shown as text.
 * - **Plain text** is fetched and shown in a <pre>.
 *
 * Nothing here interprets a PDF, and nothing asks the browser to render a
 * document as a page.
 */

import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Modal, Button } from '@/components/ui';
import api from '@/services/api';

export type DocumentFormat = 'pdf' | 'markdown' | 'text';

/**
 * The format from the original filename's extension. This mirrors the server,
 * which decides the served content type the same way and never from the
 * declared MIME type.
 */
export function documentFormat(originalName: string): DocumentFormat {
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.md')) return 'markdown';
  return 'text';
}

interface DocumentReaderProps {
  isOpen: boolean;
  onClose: () => void;
  /** The asset id. */
  documentId: string | null;
  name: string;
  originalName: string;
  /** 'overlay' when opened from inside another modal, so it stacks above it. */
  layer?: 'base' | 'overlay';
}

export default function DocumentReader({
  isOpen,
  onClose,
  documentId,
  name,
  originalName,
  layer = 'base',
}: DocumentReaderProps) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const format = documentFormat(originalName);
  const url = documentId ? api.getDocumentUrl(documentId) : '';

  // Text formats are fetched and rendered here. A PDF is left to the iframe.
  useEffect(() => {
    if (!isOpen || !documentId || format === 'pdf') {
      setText(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? 'This document is not available to you.' : 'Could not load the document.'
          );
        }
        return res.text();
      })
      .then((body) => {
        if (!cancelled) setText(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the document.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId, format, url]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={name}
      icon={FileText}
      size="xl"
      layer={layer}
      footer={
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open in a new tab
        </Button>
      }
    >
      <div className="h-[75vh] min-h-[24rem] flex flex-col">
        {format === 'pdf' ? (
          /* The browser's own PDF viewer. Same origin, so the current CSP allows
             the frame; the response's own sandbox policy contains what is inside. */
          <iframe
            src={url}
            title={name}
            className="flex-1 w-full rounded-lg border border-moss-green/20 bg-white"
          />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-sm text-ink-secondary">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-danger-ink" role="alert">
            {error}
          </p>
        ) : format === 'markdown' ? (
          /* react-markdown ignores raw HTML unless rehype-raw is added, which it
             deliberately is not. A <script> in the file is shown as text. */
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 rounded-lg border border-moss-green/20 bg-parchment/60 prose-notes">
            <ReactMarkdown>{text ?? ''}</ReactMarkdown>
          </div>
        ) : (
          <pre className="flex-1 min-h-0 overflow-auto px-4 py-3 rounded-lg border border-moss-green/20 bg-parchment/60 text-sm whitespace-pre-wrap font-mono text-ink">
            {text ?? ''}
          </pre>
        )}
      </div>
    </Modal>
  );
}
