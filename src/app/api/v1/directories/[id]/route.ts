import {NextRequest, NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {getR2Client} from "@/lib/r2-config";
import {z} from "zod";

// Schema for updating directory
const updateDirectorySchema = z.object({
  fullPath: z.string().min(1).max(1000).optional(),
  parentId: z.string().nullable().optional(),
  defaultPermissions: z.enum(["public", "private", "inherit"]).optional(),
  defaultExpirationPolicy: z.enum(["1d", "7d", "30d", "90d", "1y", "infinite"]).optional(),
});

// GET /api/v1/directories/:id - Get directory details
export async function GET(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session as any)?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session as any).user.id;

    // Get directory with stats
    const directory = await prisma.directory.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          }
        },
        parent: {
          select: {
            id: true,
            fullPath: true,
          }
        },
        // Get immediate children
        children: {
          select: {
            id: true,
            fullPath: true,
            _count: {
              select: {
                files: true,
                children: true,
              }
            }
          },
          orderBy: {
            fullPath: "asc"
          }
        },
        // Get files in this directory
        files: {
          select: {
            id: true,
            filename: true,
            fullPath: true,
            mimeType: true,
            sizeBytes: true,
            permissions: true,
            status: true,
            expirationPolicy: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            filename: "asc"
          }
        }
      }
    });

    if (!directory) {
      return NextResponse.json({error: "Directory not found"}, {status: 404});
    }

    // Transform the response
    return NextResponse.json({
      id: directory.id,
      fullPath: directory.fullPath,
      parentId: directory.parentId,
      parent: directory.parent,
      defaultPermissions: directory.defaultPermissions,
      defaultExpirationPolicy: directory.defaultExpirationPolicy,
      fileCount: directory._count.files,
      subdirectoryCount: directory._count.children,
      createdAt: directory.createdAt.toISOString(),
      updatedAt: directory.updatedAt.toISOString(),
      // Include children and files
      children: directory.children.map(child => ({
        id: child.id,
        fullPath: child.fullPath,
        fileCount: child._count.files,
        subdirectoryCount: child._count.children,
      })),
      files: directory.files.map(file => ({
        id: file.id,
        filename: file.filename,
        fullPath: file.fullPath,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes ? Number(file.sizeBytes) : null,
        permissions: file.permissions,
        status: file.status,
        expirationPolicy: file.expirationPolicy,
        expiresAt: file.expiresAt?.toISOString() || null,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      })),
    });
    
  } catch (error) {
    console.error("Error getting directory:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// PUT /api/v1/directories/:id - Update directory
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
    const validatedData = updateDirectorySchema.parse(body);

    // Find the directory and verify ownership
    const directory = await prisma.directory.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        files: true,
        children: true,
      }
    });

    if (!directory) {
      return NextResponse.json({error: "Directory not found"}, {status: 404});
    }

    // Build update data
    const updateData: {
      defaultPermissions?: string;
      defaultExpirationPolicy?: string;
      fullPath?: string;
      parentId?: string | null;
    } = {};
    
    if (validatedData.defaultPermissions !== undefined) {
      updateData.defaultPermissions = validatedData.defaultPermissions;
    }
    
    if (validatedData.defaultExpirationPolicy !== undefined) {
      updateData.defaultExpirationPolicy = validatedData.defaultExpirationPolicy;
    }
    
    // Handle path change (rename or move)
    if (validatedData.fullPath !== undefined && validatedData.fullPath !== directory.fullPath) {
      const newPath = validatedData.fullPath.startsWith("/") 
        ? validatedData.fullPath 
        : `/${validatedData.fullPath}`;
      
      // Check if new path already exists
      const existingDirectory = await prisma.directory.findFirst({
        where: {
          userId,
          fullPath: newPath,
          id: {not: id}
        }
      });
      
      if (existingDirectory) {
        return NextResponse.json({error: "Directory already exists at this path"}, {status: 409});
      }
      
      // Update the directory path
      updateData.fullPath = newPath;
      
      // Update all child directories and files recursively
      const oldPathPrefix = directory.fullPath.endsWith("/") 
        ? directory.fullPath 
        : `${directory.fullPath}/`;
      const newPathPrefix = newPath.endsWith("/") ? newPath : `${newPath}/`;
      
      // Update child directories
      if (directory.children.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "Directory" 
           SET "fullPath" = REPLACE("fullPath", $1, $2)
           WHERE "userId" = $3 AND "fullPath" LIKE $4`,
          oldPathPrefix,
          newPathPrefix,
          userId,
          `${oldPathPrefix}%`
        );
      }
      
      // Update files in this directory and subdirectories
      if (directory.files.length > 0 || directory.children.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "File" 
           SET "fullPath" = REPLACE("fullPath", $1, $2)
           WHERE "userId" = $3 AND "fullPath" LIKE $4`,
          oldPathPrefix,
          newPathPrefix,
          userId,
          `${oldPathPrefix}%`
        );
      }
    }
    
    // Handle parent change
    if (validatedData.parentId !== undefined) {
      // Verify the new parent exists and belongs to the user (if not null)
      if (validatedData.parentId !== null) {
        const parentDirectory = await prisma.directory.findFirst({
          where: {
            id: validatedData.parentId,
            userId,
          }
        });
        
        if (!parentDirectory) {
          return NextResponse.json({error: "Parent directory not found"}, {status: 404});
        }
        
        // Prevent circular references
        if (parentDirectory.fullPath.startsWith(directory.fullPath)) {
          return NextResponse.json({error: "Cannot move directory into its own subdirectory"}, {status: 400});
        }
      }
      
      updateData.parentId = validatedData.parentId;
    }
    
    // Update the directory
    const updatedDirectory = await prisma.directory.update({
      where: {id},
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          }
        }
      }
    });

    return NextResponse.json({
      id: updatedDirectory.id,
      fullPath: updatedDirectory.fullPath,
      parentId: updatedDirectory.parentId,
      defaultPermissions: updatedDirectory.defaultPermissions,
      defaultExpirationPolicy: updatedDirectory.defaultExpirationPolicy,
      fileCount: updatedDirectory._count.files,
      subdirectoryCount: updatedDirectory._count.children,
      createdAt: updatedDirectory.createdAt.toISOString(),
      updatedAt: updatedDirectory.updatedAt.toISOString(),
    });
    
  } catch (error) {
    console.error("Error updating directory:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({error: "Validation error", details: error.issues}, {status: 400});
    }
    
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// DELETE /api/v1/directories/:id - Delete directory
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

    // Find the directory and verify ownership
    const directory = await prisma.directory.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        files: {
          select: {
            id: true,
            r2Locator: true,
            status: true,
          }
        },
        _count: {
          select: {
            children: true,
          }
        }
      }
    });

    if (!directory) {
      return NextResponse.json({error: "Directory not found"}, {status: 404});
    }

    // Check if directory is empty (no subdirectories)
    if (directory._count.children > 0) {
      return NextResponse.json({
        error: "Directory is not empty", 
        details: "Please delete all subdirectories first"
      }, {status: 400});
    }

    // Delete all files in the directory from R2
    if (directory.files.length > 0) {
      const r2Client = getR2Client();
      
      for (const file of directory.files) {
        if (file.r2Locator && file.status === "validated") {
          try {
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
            console.error(`Error deleting file ${file.id} from R2:`, r2Error);
            // Continue with deletion even if R2 deletion fails
          }
        }
      }
    }

    // Delete all files in the directory from database
    if (directory.files.length > 0) {
      await prisma.file.deleteMany({
        where: {
          directoryId: id,
        }
      });
    }

    // Delete the directory
    await prisma.directory.delete({
      where: {id}
    });

    return NextResponse.json({
      message: "Directory deleted successfully",
      deletedFiles: directory.files.length,
    });
    
  } catch (error) {
    console.error("Error deleting directory:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}