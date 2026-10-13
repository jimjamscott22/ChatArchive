import React, { createContext, memo, useContext, useMemo } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

import ConversationResources from "./ConversationResources";
import { formatDateTime, getSourceInfo, orderMessages, type Message } from "../utils/conversationPresentation";
import { applyHighlightToNode } from "../utils/searchHighlight";

const HighlightQueryContext = createContext("");
const REHYPE_PLUGINS = [rehypeHighlight];

// Stable component types keep Markdown DOM mounted while the search query changes.
function withHighlight(tag: keyof JSX.IntrinsicElements) {
  return function HighlightedElement({ children, node: _node, ...props }: React.HTMLAttributes<HTMLElement> & ExtraProps) {
    const query = useContext(HighlightQueryContext);
    return React.createElement(tag, props, applyHighlightToNode(children, query));
  };
}

// Leave spans alone: syntax highlighting uses them inside code blocks.
const MARKDOWN_COMPONENTS: Components = {
  p: withHighlight("p"),
  li: withHighlight("li"),
  h1: withHighlight("h1"),
  h2: withHighlight("h2"),
  h3: withHighlight("h3"),
  h4: withHighlight("h4"),
  h5: withHighlight("h5"),
  h6: withHighlight("h6"),
  blockquote: withHighlight("blockquote"),
  strong: withHighlight("strong"),
  em: withHighlight("em"),
  a: withHighlight("a"),
};

// Query updates reach the context consumers above without rerunning the parser.
const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown rehypePlugins={REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
});

type ConversationReaderProps = {
  conversationId: number;
  source: string;
  messages: readonly Message[];
  highlightQuery: string;
};

const ConversationReader = memo(function ConversationReader({
  conversationId,
  source,
  messages,
  highlightQuery,
}: ConversationReaderProps) {
  const orderedMessages = useMemo(() => orderMessages(messages), [messages]);
  const sourceInfo = getSourceInfo(source);

  return (
    <div className="conversation-view">
      <HighlightQueryContext.Provider value={highlightQuery}>
        {orderedMessages.map((msg, index) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-header">
              <div className="message-avatar">
                {msg.role === "user" ? (
                  <div className="user-avatar">👤</div>
                ) : (
                  <div className="assistant-avatar" data-source={source}>
                    {sourceInfo.icon}
                  </div>
                )}
              </div>
              <div className="message-meta">
                <div className="message-role">{msg.role === "user" ? "You" : sourceInfo.name}</div>
                <div className="message-time">
                  {formatDateTime(msg.created_at)}
                  <span className="message-number">Message {index + 1}</span>
                </div>
              </div>
            </div>
            <div className="message-content markdown-content">
              <MessageMarkdown content={msg.content} />
            </div>
          </div>
        ))}
      </HighlightQueryContext.Provider>
      <ConversationResources conversationId={conversationId} />
    </div>
  );
});

export default ConversationReader;
