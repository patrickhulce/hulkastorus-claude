import {NextRequest, NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {z} from "zod";

// Schema for creating directories
const createDirectorySchema = z.object({
  fullPath: z.string().min(1).max(1000),
  parentId: z.string().optional(),
  defaultPermissions: z.enum(["public", "private", "inherit"]).default("private"),
  defaultExpirationPolicy: z.enum(["1d", "7d", "30d", "90d", "1y", "infinite"]).default("infinite"),
});

// Schema for listing directories
const listDirectoriesSchema = z.object({
  parentId: z.string().optional(),
  path: z.string().optional(),
  recursive: z.coerce.boolean().default(false),
});

// POST /api/v1/directories - Create a new directory
export async function POST(request: NextRequest) {
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
    const {fullPath, defaultPermissions, defaultExpirationPolicy} = 
      createDirectorySchema.parse(body);

    // Normalize path
    const normalizedPath = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
    const pathParts = normalizedPath.split("/").filter(Boolean);
    
    if (pathParts.length === 0) {
      return NextResponse.json({error: "Invalid path"}, {status: 400});
    }

    // Create all parent directories if they don't exist
    let currentPath = "";
    let currentParentId: string | null = null;
    let lastDirectory = null;

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
        update: {
          // Update default policies if this is the target directory
          ...(currentPath === normalizedPath ? {
            defaultPermissions,
            defaultExpirationPolicy,
          } : {})
        },
        create: {
          id: `dir_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          fullPath: currentPath,
          parentId: currentParentId,
          defaultPermissions: currentPath === normalizedPath ? defaultPermissions : "private",
          defaultExpirationPolicy: currentPath === normalizedPath ? defaultExpirationPolicy : "infinite",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      });
      
      currentParentId = directory.id;
      lastDirectory = directory;
    }

    if (!lastDirectory) {
      return NextResponse.json({error: "Failed to create directory"}, {status: 500});
    }

    // Get the created directory with its children count
    const directoryWithStats = await prisma.directory.findUnique({
      where: {id: lastDirectory.id},
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
      id: directoryWithStats!.id,
      fullPath: directoryWithStats!.fullPath,
      parentId: directoryWithStats!.parentId,
      defaultPermissions: directoryWithStats!.defaultPermissions,
      defaultExpirationPolicy: directoryWithStats!.defaultExpirationPolicy,
      fileCount: directoryWithStats!._count.files,
      subdirectoryCount: directoryWithStats!._count.children,
      createdAt: directoryWithStats!.createdAt.toISOString(),
      updatedAt: directoryWithStats!.updatedAt.toISOString(),
    }, {status: 201});
    
  } catch (error) {
    console.error("Error creating directory:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({error: "Validation error", details: error.issues}, {status: 400});
    }
    
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// GET /api/v1/directories - List directories
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session as any)?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session as any).user.id;

    // Parse query parameters
    const {searchParams} = new URL(request.url);
    const params = {
      parentId: searchParams.get("parentId") || undefined,
      path: searchParams.get("path") || undefined,
      recursive: searchParams.get("recursive") === "true",
    };

    const validatedParams = listDirectoriesSchema.parse(params);

    // Build query conditions
    const where: {
      userId: string;
      parentId?: string;
      fullPath?: string | { startsWith: string };
    } = {userId};

    if (validatedParams.parentId !== undefined) {
      where.parentId = validatedParams.parentId;
    }

    if (validatedParams.path) {
      if (validatedParams.recursive) {
        // Get all directories under this path
        where.fullPath = {
          startsWith: validatedParams.path.endsWith("/") 
            ? validatedParams.path 
            : `${validatedParams.path}/`
        };
      } else {
        // Get exact path match
        where.fullPath = validatedParams.path;
      }
    }

    // Get directories with stats
    const directories = await prisma.directory.findMany({
      where,
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
        }
      },
      orderBy: {
        fullPath: "asc",
      }
    });

    // Transform the results
    const transformedDirectories = directories.map(dir => ({
      id: dir.id,
      fullPath: dir.fullPath,
      parentId: dir.parentId,
      parent: dir.parent,
      defaultPermissions: dir.defaultPermissions,
      defaultExpirationPolicy: dir.defaultExpirationPolicy,
      fileCount: dir._count.files,
      subdirectoryCount: dir._count.children,
      createdAt: dir.createdAt.toISOString(),
      updatedAt: dir.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      directories: transformedDirectories,
      total: transformedDirectories.length,
    });
    
  } catch (error) {
    console.error("Error listing directories:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({error: "Validation error", details: error.issues}, {status: 400});
    }
    
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}