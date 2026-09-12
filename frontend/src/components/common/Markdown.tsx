/**
 * The one Markdown renderer.
 *
 * Personal notes and documents both show Markdown a person typed, and both used
 * to call react-markdown directly with no plugins. That left two renderers with
 * the same two gaps: tables did not render, because they are a GitHub-flavoured
 * extension and not core Markdown, and a single Enter was folded into the line
 * above, which is correct CommonMark and wrong for notes typed at a table. It
 * also meant the settings that make user-written Markdown safe existed twice.
 *
 * Now there is one. What it deliberately does not do:
 *
 * - **Render raw HTML.** react-markdown ignores it unless rehype-raw is added,
 *   and it is not. A <script> in a note is shown as the text "<script>".
 * - **Pass through unsafe links.** react-markdown's default URL transform drops
 *   javascript:, data: and the like, leaving an empty href. remark-gfm's
 *   autolinks only ever produce http, https and mailto, so nothing new can
 *   arrive that way.
 *
 * Adding a plugin here changes every place Markdown is shown. That is the
 * point; check both when you do.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const plugins = [remarkGfm, remarkBreaks];

interface MarkdownProps {
  children: string;
}

export default function Markdown({ children }: MarkdownProps) {
  return <ReactMarkdown remarkPlugins={plugins}>{children}</ReactMarkdown>;
}
