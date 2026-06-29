import { NextRequest, NextResponse } from "next/server"
import { uploadImageFromUrl, uploadImageFromBase64, uploadFileFromBase64 } from "@/lib/cloudinary"
import requireRole from "@/lib/roles"

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { imageUrl, base64Image, base64File, folder } = body
    if (!imageUrl && !base64Image && !base64File) return NextResponse.json({ error: "imageUrl, base64Image, or base64File is required" }, { status: 400 })

    const dataUri = base64Image || (typeof imageUrl === "string" && imageUrl.startsWith("data:image") ? imageUrl : null)
    const result = base64File
      ? await uploadFileFromBase64(base64File, folder || "quotetion/chat")
      : dataUri
        ? await uploadImageFromBase64(dataUri, folder || "quotetion/products")
        : await uploadImageFromUrl(imageUrl, folder || "quotetion/products")

    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
