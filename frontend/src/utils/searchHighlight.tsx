import React from "react";

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const renderHighlightedText = (text: string, query: string): React.ReactNode => {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;
  const escapedTokens = tokens.map(escapeRegExp);
  const regex = new RegExp(`(${escapedTokens.join("|")})`, "gi");
  const lowerTokens = new Set(tokens.map((token) => token.toLowerCase()));
  return text.split(regex).map((part, index) => {
    if (lowerTokens.has(part.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="search-highlight">
          {part}
        </mark>
      );
    }
    return part;
  });
};

export const applyHighlightToNode = (node: React.ReactNode, query: string): React.ReactNode => {
  const trimmed = query.trim();
  if (!trimmed) return node;
  if (typeof node === "string") {
    return renderHighlightedText(node, trimmed);
  }
  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <React.Fragment key={index}>{applyHighlightToNode(child, trimmed)}</React.Fragment>
    ));
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    const elementType = typeof node.type === "string" ? node.type : "";
    if (elementType === "code" || elementType === "pre" || elementType === "mark") {
      return node;
    }
    const children = node.props?.children;
    if (!children) return node;
    return React.cloneElement(node, {
      children: applyHighlightToNode(children, trimmed),
    });
  }
  return node;
};
