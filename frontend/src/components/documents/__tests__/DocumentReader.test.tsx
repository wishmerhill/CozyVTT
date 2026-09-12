/**
 * Reading a document inside CozyVTT.
 *
 * The case that matters is Markdown containing HTML. The server serves the
 * file as text/plain so the browser never renders it as a page, and this
 * component renders it with react-markdown, which ignores raw HTML unless
 * rehype-raw is added. That must stay true: a <script> in a shared house-rules
 * file has to end up as visible text, never as a script element.
 *
 * The PDF path is an <iframe> pointing at the document route. What is checked
 * is that it points at the right URL and nothing else, because everything that
 * makes an inline PDF safe is on the response, not in here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DocumentReader, { documentFormat } from '../DocumentReader';

vi.mock('@/services/api', () => {
  const client = {
    getDocumentUrl: (id: string) => `/api/assets/documents/${id}`,
  };
  return { api: client, default: client };
});

const originalFetch = globalThis.fetch;

function mockFetch(body: string, status = 200) {
  globalThis.fetch = vi.fn(async () =>
    new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  ) as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('documentFormat', () => {
  it('decides from the extension, case-insensitively', () => {
    expect(documentFormat('rules.pdf')).toBe('pdf');
    expect(documentFormat('RULES.PDF')).toBe('pdf');
    expect(documentFormat('house-rules.md')).toBe('markdown');
    expect(documentFormat('notes.txt')).toBe('text');
  });

  it('treats anything unrecognised as plain text, the safest reading', () => {
    expect(documentFormat('mystery')).toBe('text');
  });
});

describe('DocumentReader', () => {
  it('shows a PDF in an iframe pointing at the document route', () => {
    render(
      <DocumentReader isOpen onClose={vi.fn()} documentId="doc-1" name="Rules" originalName="rules.pdf" />
    );
    const frame = screen.getByTitle('Rules');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', '/api/assets/documents/doc-1');
  });

  it('does not fetch a PDF itself', () => {
    mockFetch('should not be called');
    render(
      <DocumentReader isOpen onClose={vi.fn()} documentId="doc-1" name="Rules" originalName="rules.pdf" />
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('renders Markdown', async () => {
    mockFetch('# House Rules\n\nRoll a d20 for *everything*.');
    render(
      <DocumentReader isOpen onClose={vi.fn()} documentId="doc-2" name="House Rules" originalName="rules.md" />
    );
    expect(await screen.findByRole('heading', { name: 'House Rules', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('everything')).toBeInTheDocument();
  });

  it('shows HTML inside Markdown as text, never as elements', async () => {
    mockFetch('Read this:\n\n<script>window.__pwned = true</script>\n\n<img src=x onerror="window.__pwned=true">');
    render(
      <DocumentReader isOpen onClose={vi.fn()} documentId="doc-3" name="Sneaky" originalName="sneaky.md" />
    );
    const shown = await screen.findByText(/Read this/);

    // The modal renders through a portal, so look at the document, not the
    // render container. Querying the container would pass with nothing in it,
    // which is the wrong way for a security test to pass.
    const reader = shown.closest('[role="dialog"]') ?? document.body;
    expect(reader.querySelector('script')).toBeNull();
    expect(reader.querySelector('img[src="x"]')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    // The tag text is still there for a person to read, as text.
    expect(reader.textContent).toContain('<script>');
  });

  it('shows plain text preformatted', async () => {
    mockFetch('line one\n  indented line two');
    render(
      <DocumentReader isOpen onClose={vi.fn()} documentId="doc-4" name="Notes" originalName="notes.txt" />
    );
    const shown = await screen.findByText(/line one/);
    expect(shown.tagName).toBe('PRE');
    expect(shown.textContent).toContain('  indented line two');
  });

  it('says so when the document is not available to the reader', async () => {
    mockFetch('', 404);
    render(
      <DocumentReader isOpen onClose={vi.fn()} documentId="doc-5" name="Private" originalName="private.md" />
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/not available to you/i);
  });

  it('offers the same URL for opening in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <DocumentReader isOpen onClose={vi.fn()} documentId="doc-1" name="Rules" originalName="rules.pdf" />
    );
    screen.getByRole('button', { name: /open in a new tab/i }).click();
    expect(open).toHaveBeenCalledWith('/api/assets/documents/doc-1', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('fetches nothing while closed', async () => {
    mockFetch('unused');
    render(
      <DocumentReader isOpen={false} onClose={vi.fn()} documentId="doc-2" name="X" originalName="x.md" />
    );
    await waitFor(() => expect(globalThis.fetch).not.toHaveBeenCalled());
  });
});
