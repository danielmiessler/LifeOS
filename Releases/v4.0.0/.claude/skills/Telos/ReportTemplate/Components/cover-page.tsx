interface CoverPageProps {
  clientName: string
  reportTitle: string
  reportDate: string
  classification: string
}

export function CoverPage({
  clientName,
  reportTitle,
  reportDate,
  classification,
}: CoverPageProps) {
  return (
    <div className="cover-page">
      <div className="cover-classification">{classification}</div>

      <div className="flex-1 flex flex-col justify-center">
        {/* Logo - left-justified above title */}
        <img
          src="/your-logo.png"
          alt="{YOUR_BUSINESS_NAME}"
          width={125}
          height={125}
          className="mb-6 -ml-4"
        />
        <div className="font-accent text-lg tracking-[0.25em] text-primary uppercase mb-4">
          TELOS Assessment
        </div>
        <h1 className="cover-title">{reportTitle}</h1>
        <p className="cover-subtitle">Prepared for {clientName}</p>
      </div>

      <div className="cover-meta">
        <p className="cover-date">{reportDate}</p>
        <p className="text-muted-dark text-sm mt-2">
          {YOUR_BUSINESS_NAME} Consulting
        </p>
      </div>
    </div>
  )
}
