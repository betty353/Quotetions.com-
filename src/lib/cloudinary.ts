import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export async function uploadImageFromUrl(imageUrl: string, folder = "quotely/products") {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials not configured")
  }

  const res = await cloudinary.uploader.upload(imageUrl, {
    folder,
    use_filename: true,
    unique_filename: false,
    overwrite: false,
  })

  return res
}

export async function uploadImageFromBase64(base64Image: string, folder = "quotely/products") {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials not configured")
  }

  if (!base64Image.startsWith("data:image")) {
    throw new Error("base64Image must be a valid data URI")
  }

  const res = await cloudinary.uploader.upload(base64Image, {
    folder,
    use_filename: true,
    unique_filename: false,
    overwrite: false,
  })

  return res
}

export default cloudinary
