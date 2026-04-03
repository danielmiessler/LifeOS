interface CalloutProps {
  label?: string
  children: React.ReactNode
}

export function Callout({ label = "Key Takeaway", children }: CalloutProps) {
  return (
    <div className="callout">
      <div className="callout-label">{label}</div>
      <div className="callout-content">{children}</div>
    </div>
  )
}
