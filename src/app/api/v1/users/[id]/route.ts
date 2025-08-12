import {NextRequest, NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";

export async function DELETE(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;

    // Barebones implementation - no auth check
    await prisma.user.delete({
      where: {
        id: id,
      },
    });

    return NextResponse.json({message: "User deleted successfully"}, {status: 200});
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({error: "Failed to delete user"}, {status: 500});
  }
}
