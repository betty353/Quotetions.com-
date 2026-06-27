import Image, { type ImageProps } from "next/image"

const passthroughLoader: ImageProps["loader"] = ({ src }) => src

export default function SafeImage({ alt, ...props }: ImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      loader={passthroughLoader}
      unoptimized
    />
  )
}
