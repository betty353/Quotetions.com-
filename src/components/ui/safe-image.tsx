import type { ImgHTMLAttributes } from "react"

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string
  alt: string
  width?: number | string
  height?: number | string
}

export default function SafeImage({ alt, loading = "lazy", decoding = "async", ...props }: SafeImageProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} loading={loading} decoding={decoding} />
}
