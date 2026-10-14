/** 圖釘圖示（無文字） */
export function PinIcon({
  className,
  title,
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M16 12V4h1a1 1 0 1 0 0-2H7a1 1 0 1 0 0 2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2Z"
      />
    </svg>
  )
}
