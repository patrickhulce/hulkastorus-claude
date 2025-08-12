import {NextRequest, NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {getR2Client} from "@/lib/r2-config";
import {getToken} from "next-auth/jwt";

// Helper function to check file access permissions (same as download route)
async function checkFileAccess(
  fileId: string,
  userId?: string,
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  file: any;
  hasAccess: boolean;
}> {
  const file = await prisma.file.findUnique({
    where: {id: fileId},
    include: {
      user: {
        select: {id: true},
      },
    },
  });

  if (!file) {
    return {file: null, hasAccess: false};
  }

  // File must be validated to be downloadable
  if (file.status !== "validated") {
    return {file, hasAccess: false};
  }

  // Check if file has expired
  if (file.expiresAt && file.expiresAt < new Date()) {
    return {file, hasAccess: false};
  }

  // Public files are accessible to everyone
  if (file.permissions === "public") {
    return {file, hasAccess: true};
  }

  // Private files require authentication and ownership
  if (file.permissions === "private") {
    if (!userId) {
      return {file, hasAccess: false};
    }

    // Owner has access
    if (file.userId === userId) {
      return {file, hasAccess: true};
    }

    // TODO: Check API key permissions when implemented
    // For now, only owner has access
    return {file, hasAccess: false};
  }

  return {file, hasAccess: false};
}

export async function GET(request: NextRequest, {params}: {params: Promise<{pseudo_id: string}>}) {
  try {
    const {pseudo_id} = await params;
    const {searchParams} = new URL(request.url);
    const downloadToken = searchParams.get("token");

    // The pseudo_id is the file ID (NanoID) for now
    // TODO: Implement user_id + path parsing if needed
    const fileId = pseudo_id;

    // Try to get user from NextAuth session
    let userId: string | undefined;
    try {
      const session = await auth();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId = (session as any)?.user?.id;
    } catch {
      // Continue without session
    }

    // If no session, try to get user from JWT token
    if (!userId && downloadToken) {
      try {
        await getToken({
          req: request,
          secret: process.env.NEXTAUTH_SECRET,
          raw: true,
        });
        // TODO: Parse custom download token if different from NextAuth JWT
      } catch {
        // Continue without token
      }
    }

    // TODO: Check API key in Authorization header
    // const authHeader = request.headers.get("authorization");
    // if (authHeader?.startsWith("Bearer ")) {
    //   const apiKey = authHeader.slice(7);
    //   // Look up API key and get user
    // }

    // Check file access
    const {file, hasAccess} = await checkFileAccess(fileId, userId);

    if (!file) {
      return NextResponse.json({error: "File not found"}, {status: 404});
    }

    if (!hasAccess) {
      return NextResponse.json({error: "File not found"}, {status: 404});
    }

    if (!file.r2Locator) {
      return NextResponse.json({error: "File not available"}, {status: 500});
    }

    // Parse R2 locator to get object parameters
    const r2Client = getR2Client();
    const objectParts = r2Client.parseObjectKey(file.r2Locator);

    if (!objectParts) {
      return NextResponse.json({error: "Invalid file locator"}, {status: 500});
    }

    // Generate presigned download URL
    const downloadUrl = await r2Client.getDownloadUrl({
      ...objectParts,
      expiresIn: 3600, // 1 hour
    });

    // Redirect to the presigned URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error("Error generating public download URL:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
