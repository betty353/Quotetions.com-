import { NextRequest, NextResponse } from "next/server"
import { uploadImageFromUrl, uploadImageFromBase64 } from "@/lib/cloudinary"
import requireRole from "@/lib/roles"

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { imageUrl, base64Image } = body
    if (!imageUrl && !base64Image) return NextResponse.json({ error: "imageUrl or base64Image is required" }, { status: 400 })

    const dataUri = base64Image || (typeof imageUrl === "string" && imageUrl.startsWith("data:image") ? imageUrl : null)
    const result = dataUri
      ? await uploadImageFromBase64(dataUri)
      : await uploadImageFromUrl(imageUrl)

    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
