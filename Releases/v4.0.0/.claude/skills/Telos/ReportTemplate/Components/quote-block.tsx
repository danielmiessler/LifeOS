interface QuoteBlockProps {
  quote: string
  attribution: string
  role?: string
}

export function QuoteBlock({ quote, attribution, role }: QuoteBlockProps) {
  return (
    <div className="quote-block">
      <p className="quote-text">{quote}</p>
      <p className="quote-attribution">
        — {attribution}
        {role && <span className="text-muted">, {role}</span>}
      </p>
    </div>
  )
}
