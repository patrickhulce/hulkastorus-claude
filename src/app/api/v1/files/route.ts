import {NextRequest, NextResponse} from "next/server";
import {auth} from "@/lib/auth";
import {prisma} from "@/lib/prisma";
import {getR2Client, currentEnv, parseLifecyclePolicy} from "@/lib/r2-config";
import {generateNanoId} from "@/lib/nanoid";
import {z} from "zod";

// Validation schema for file creation
const createFileSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().min(0).optional(),
  fullPath: z.string().default("/"),
  expirationPolicy: z.string().default("infinite"),
  permissions: z.enum(["public", "private", "inherit"]).default("private"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session as any)?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: {id: (session as any).user.id},
      select: {
        id: true,
        isEmailVerified: true,
        // TODO: Add quota fields when implemented
      },
    });

    if (!user) {
      return NextResponse.json({error: "User not found"}, {status: 404});
    }

    // TODO: Re-enable email verification check
    // if (!user.isEmailVerified) {
    //   return NextResponse.json({error: "Email verification required"}, {status: 403});
    // }

    // TODO: Check user quota
    // This would be implemented when quota tracking is added

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createFileSchema.parse(body);

    const {filename, mimeType, sizeBytes, fullPath, expirationPolicy, permissions} = validatedData;

    // Generate file ID
    const fileId = generateNanoId();

    // Parse and validate expiration policy
    const validatedExpirationPolicy = parseLifecyclePolicy(expirationPolicy);

    // Normalize and validate full path
    const normalizedPath = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;

    // Extract directory path (everything except the filename)
    const directoryPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/")) || "/";
    const pathParts = directoryPath === "/" ? [] : directoryPath.split("/").filter(Boolean);

    // Find or create directory structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentDirectory: any = null;
    let currentPath = "";

    // Create root directory if it doesn't exist
    if (pathParts.length === 0) {
      // File goes in root directory
      currentDirectory = await prisma.directory.upsert({
        where: {
          userId_fullPath: {
            userId: user.id,
            fullPath: "/",
          },
        },
        update: {},
        create: {
          id: generateNanoId(),
          userId: user.id,
          fullPath: "/",
          defaultExpirationPolicy: "infinite",
          defaultPermissions: "private",
        },
      });
    } else {
      // Create directory hierarchy
      for (const part of pathParts) {
        currentPath += `/${part}`;
        const parentId = currentDirectory?.id;

        currentDirectory = await prisma.directory.upsert({
          where: {
            userId_fullPath: {
              userId: user.id,
              fullPath: currentPath,
            },
          },
          update: {},
          create: {
            id: generateNanoId(),
            userId: user.id,
            parentId,
            fullPath: currentPath,
            defaultExpirationPolicy: validatedExpirationPolicy,
            defaultPermissions: permissions === "inherit" ? "private" : permissions,
          },
        });
      }
    }

    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (validatedExpirationPolicy !== "infinite") {
      const days = parseInt(validatedExpirationPolicy.replace("d", ""));
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    // Create file record in database
    const file = await prisma.file.create({
      data: {
        id: fileId,
        userId: user.id,
        directoryId: currentDirectory.id,
        status: "reserved",
        expirationPolicy: validatedExpirationPolicy,
        fullPath: normalizedPath,
        filename,
        mimeType,
        sizeBytes: sizeBytes ? BigInt(sizeBytes) : null,
        permissions: permissions === "inherit" ? currentDirectory.defaultPermissions : permissions,
        expiresAt,
      },
    });

    // Generate R2 upload URL
    const r2Client = getR2Client();
    const {uploadUrl, objectKey} = await r2Client.getUploadUrl({
      env: currentEnv,
      lifecyclePolicy: validatedExpirationPolicy,
      userId: user.id,
      fileId,
      contentType: mimeType,
      expiresIn: 3600, // 1 hour
    });

    // Store R2 locator in database
    await prisma.file.update({
      where: {id: fileId},
      data: {r2Locator: objectKey},
    });

    return NextResponse.json({
      id: fileId,
      uploadUrl,
      filename,
      fullPath: normalizedPath,
      expirationPolicy: validatedExpirationPolicy,
      permissions: file.permissions,
      expiresAt,
      status: "reserved",
    });
  } catch (error) {
    console.error("Error creating file:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({error: "Validation error", details: error.issues}, {status: 400});
    }

    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// List files endpoint
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(session as any)?.user?.id) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {searchParams} = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 1000); // Allow up to 1000 for dashboard
    const offset = parseInt(searchParams.get("offset") || "0");
    const orderBy = searchParams.get("order_by") || "createdAt+desc";

    // Parse order by
    const [field, direction] = orderBy.split("+");
    const orderDirection = direction === "asc" ? "asc" : "desc";

    // Validate field name - map common field names and validate
    const validFields = ["createdAt", "updatedAt", "filename", "sizeBytes"];
    const validatedField = validFields.includes(field) ? field : "createdAt";

    // Get filters
    const permissionsFilter = searchParams.get("filter~permissions");
    const statusFilter = searchParams.get("filter~status");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId: (session as any).user.id,
    };

    if (permissionsFilter) {
      whereClause.permissions = permissionsFilter;
    }

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const files = await prisma.file.findMany({
      where: whereClause,
      orderBy: {
        [validatedField]: orderDirection,
      },
      skip: offset,
      take: limit,
      include: {
        directory: {
          select: {
            fullPath: true,
          },
        },
      },
    });

    const total = await prisma.file.count({
      where: whereClause,
    });

    return NextResponse.json({
      files: files.map((file) => ({
        id: file.id,
        filename: file.filename,
        fullPath: file.fullPath,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes ? Number(file.sizeBytes) : null,
        permissions: file.permissions,
        status: file.status,
        expirationPolicy: file.expirationPolicy,
        expiresAt: file.expiresAt,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        directory: file.directory,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error listing files:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
