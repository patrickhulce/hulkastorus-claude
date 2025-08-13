import {NextRequest, NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {getR2Client} from "@/lib/r2-config";
import {z} from "zod";

// Schema for updating file metadata
const updateFileSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  fullPath: z.string().min(1).max(1000).optional(),
  permissions: z.enum(["public", "private", "inherit"]).optional(),
  expirationPolicy: z.enum(["1d", "7d", "30d", "90d", "1y", "infinite"]).optional(),
  directoryId: z.string().optional(),
});

// Helper function to calculate expiration date
function calculateExpirationDate(policy: string): Date | null {
  if (policy === "infinite") return null;
  
  const now = new Date();
  const expirationMap: Record<string, number> = {
    "1d": 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  
  const days = expirationMap[policy];
  if (!days) return null;
  
  now.setDate(now.getDate() + days);
  return now;
}

// PUT /api/v1/files/:id - Update file metadata
export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session as any)?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session as any).user.id;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateFileSchema.parse(body);

    // Find the file and verify ownership
    const file = await prisma.file.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        directory: true,
      }
    });

    if (!file) {
      return NextResponse.json({error: "File not found"}, {status: 404});
    }

    // Build update data
    const updateData: {
      filename?: string;
      permissions?: string;
      directoryId?: string;
      fullPath?: string;
      expirationPolicy?: string;
      expiresAt?: Date | null;
    } = {};
    
    if (validatedData.filename !== undefined) {
      updateData.filename = validatedData.filename;
    }
    
    if (validatedData.permissions !== undefined) {
      updateData.permissions = validatedData.permissions;
    }
    
    if (validatedData.expirationPolicy !== undefined) {
      updateData.expirationPolicy = validatedData.expirationPolicy;
      updateData.expiresAt = calculateExpirationDate(validatedData.expirationPolicy);
    }
    
    // Handle directory change and path update
    if (validatedData.directoryId !== undefined || validatedData.fullPath !== undefined) {
      let targetDirectoryId = validatedData.directoryId || file.directoryId;
      let targetPath = validatedData.fullPath || file.fullPath;
      
      // If changing directory, verify it exists and belongs to the user
      if (validatedData.directoryId && validatedData.directoryId !== file.directoryId) {
        const targetDirectory = await prisma.directory.findFirst({
          where: {
            id: validatedData.directoryId,
            userId,
          }
        });
        
        if (!targetDirectory) {
          return NextResponse.json({error: "Target directory not found"}, {status: 404});
        }
        
        // Update the full path to reflect the new directory
        if (!validatedData.fullPath) {
          targetPath = targetDirectory.fullPath === "/" 
            ? `/${file.filename}`
            : `${targetDirectory.fullPath}/${file.filename}`;
        }
      }
      
      // If changing path, ensure parent directories exist
      if (validatedData.fullPath && validatedData.fullPath !== file.fullPath) {
        const pathParts = targetPath.split("/").filter(Boolean);
        const filename = pathParts.pop() || file.filename;
        
        if (pathParts.length > 0) {
          // Create or find parent directories
          let currentPath = "";
          let parentDirectoryId = null;
          
          for (const part of pathParts) {
            currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const directory: any = await prisma.directory.upsert({
              where: {
                userId_fullPath: {
                  userId,
                  fullPath: currentPath,
                }
              },
              update: {},
              create: {
                id: `dir_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId,
                fullPath: currentPath,
                parentId: parentDirectoryId,
                defaultPermissions: "private",
                defaultExpirationPolicy: "infinite",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any
            });
            
            parentDirectoryId = directory.id;
          }
          
          targetDirectoryId = parentDirectoryId || targetDirectoryId;
        }
        
        updateData.filename = filename;
      }
      
      updateData.directoryId = targetDirectoryId;
      updateData.fullPath = targetPath;
    }
    
    // Update the file
    const updatedFile = await prisma.file.update({
      where: {id},
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        directory: {
          select: {
            fullPath: true,
          }
        }
      }
    });

    // Return updated file
    return NextResponse.json({
      id: updatedFile.id,
      filename: updatedFile.filename,
      fullPath: updatedFile.fullPath,
      mimeType: updatedFile.mimeType,
      sizeBytes: updatedFile.sizeBytes ? Number(updatedFile.sizeBytes) : null,
      permissions: updatedFile.permissions,
      status: updatedFile.status,
      expirationPolicy: updatedFile.expirationPolicy,
      expiresAt: updatedFile.expiresAt?.toISOString() || null,
      directoryId: updatedFile.directoryId,
      directory: updatedFile.directory,
      createdAt: updatedFile.createdAt.toISOString(),
      updatedAt: updatedFile.updatedAt.toISOString(),
    });
    
  } catch (error) {
    console.error("Error updating file:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({error: "Validation error", details: error.issues}, {status: 400});
    }
    
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// DELETE /api/v1/files/:id - Delete a file
export async function DELETE(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session as any)?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session as any).user.id;

    // Find the file and verify ownership
    const file = await prisma.file.findFirst({
      where: {
        id,
        userId,
      }
    });

    if (!file) {
      return NextResponse.json({error: "File not found"}, {status: 404});
    }

    // Delete from R2 if file was uploaded
    if (file.r2Locator && file.status === "validated") {
      try {
        const r2Client = getR2Client();
        const locatorParts = file.r2Locator.split("/");
        
        if (locatorParts.length === 4) {
          const [env, lifecyclePolicy, storedUserId, fileId] = locatorParts;
          
          await r2Client.deleteObject({
            env,
            lifecyclePolicy,
            userId: storedUserId,
            fileId,
          });
          
          console.log(`Deleted file from R2: ${file.r2Locator}`);
        }
      } catch (r2Error) {
        console.error("Error deleting file from R2:", r2Error);
        // Continue with database deletion even if R2 deletion fails
        // The file will be cleaned up by lifecycle policies
      }
    }

    // Delete from database
    await prisma.file.delete({
      where: {id}
    });

    return NextResponse.json({message: "File deleted successfully"});
    
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// GET /api/v1/files/:id - Get file metadata
export async function GET(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session as any)?.user?.id;

    // Find the file
    const file = await prisma.file.findUnique({
      where: {id},
      include: {
        directory: {
          select: {
            id: true,
            fullPath: true,
            defaultPermissions: true,
            defaultExpirationPolicy: true,
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!file) {
      return NextResponse.json({error: "File not found"}, {status: 404});
    }

    // Check access permissions
    const isOwner = file.userId === userId;
    const isPublic = file.permissions === "public";
    
    if (!isOwner && !isPublic) {
      return NextResponse.json({error: "File not found"}, {status: 404});
    }

    // Check if file is expired
    if (file.expiresAt && file.expiresAt < new Date()) {
      return NextResponse.json({error: "File has expired"}, {status: 404});
    }

    // Return file metadata
    return NextResponse.json({
      id: file.id,
      filename: file.filename,
      fullPath: file.fullPath,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes ? Number(file.sizeBytes) : null,
      permissions: file.permissions,
      status: file.status,
      expirationPolicy: file.expirationPolicy,
      expiresAt: file.expiresAt?.toISOString() || null,
      directoryId: file.directoryId,
      directory: file.directory,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      // Include owner info for public files
      owner: isPublic ? {
        id: file.user.id,
        name: `${file.user.firstName} ${file.user.lastName}`,
      } : undefined,
      // Include download URL for accessible files
      downloadUrl: file.status === "validated" ? 
        (isPublic ? `/d/${file.id}` : `/api/v1/files/${file.id}/download`) : 
        undefined,
    });
    
  } catch (error) {
    console.error("Error getting file:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}