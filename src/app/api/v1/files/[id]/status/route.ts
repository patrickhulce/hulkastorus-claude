import {NextRequest, NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {getR2Client} from "@/lib/r2-config";
import {z} from "zod";

const updateStatusSchema = z.object({
  status: z.enum(["uploaded"]),
});

export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any;
  const {id} = await params;

  try {
    session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session as any)?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    // Parse and validate request body
    const body = await request.json();
    const {status} = updateStatusSchema.parse(body);

    if (status !== "uploaded") {
      return NextResponse.json({error: "Only 'uploaded' status is supported"}, {status: 400});
    }

    // Find the file and verify ownership
    const file = await prisma.file.findFirst({
      where: {
        id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userId: (session as any).user.id,
        status: "reserved",
      },
    });

    if (!file) {
      return NextResponse.json({error: "File not found or not in reserved status"}, {status: 404});
    }

    if (!file.r2Locator) {
      return NextResponse.json({error: "File has no R2 locator"}, {status: 400});
    }

    // Parse R2 locator to get object parameters
    const r2Client = getR2Client();
    const objectParts = r2Client.parseObjectKey(file.r2Locator);

    if (!objectParts) {
      return NextResponse.json({error: "Invalid R2 locator format"}, {status: 400});
    }

    // Verify file exists in R2 and get metadata
    const objectInfo = await r2Client.getObjectInfo(objectParts);

    if (!objectInfo.exists) {
      // File was not actually uploaded
      await prisma.file.update({
        where: {id},
        data: {
          status: "failed",
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({error: "File not found in storage"}, {status: 400});
    }

    // Update file metadata from R2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      status: "validated",
      updatedAt: new Date(),
    };

    if (objectInfo.size !== undefined) {
      updateData.sizeBytes = BigInt(objectInfo.size);
    }

    if (objectInfo.contentType && !file.mimeType) {
      updateData.mimeType = objectInfo.contentType;
    }

    const updatedFile = await prisma.file.update({
      where: {id},
      data: updateData,
    });

    return NextResponse.json({
      id: updatedFile.id,
      status: updatedFile.status,
      filename: updatedFile.filename,
      fullPath: updatedFile.fullPath,
      mimeType: updatedFile.mimeType,
      sizeBytes: updatedFile.sizeBytes ? Number(updatedFile.sizeBytes) : null,
      permissions: updatedFile.permissions,
      expirationPolicy: updatedFile.expirationPolicy,
      expiresAt: updatedFile.expiresAt,
      createdAt: updatedFile.createdAt,
      updatedAt: updatedFile.updatedAt,
    });
  } catch (error) {
    console.error("Error updating file status:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({error: "Validation error", details: error.issues}, {status: 400});
    }

    // If R2 operation failed, mark file as failed
    if (id && session?.user?.id) {
      try {
        await prisma.file.updateMany({
          where: {
            id: id,
            userId: session.user.id,
            status: "reserved",
          },
          data: {
            status: "failed",
            updatedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.error("Error marking file as failed:", dbError);
      }
    }

    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
