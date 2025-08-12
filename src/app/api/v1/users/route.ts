import {NextRequest, NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {generateNanoId} from "@/lib/nanoid";
import * as bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Hash the password
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // Barebones implementation - minimal validation
    const user = await prisma.user.create({
      data: {
        id: generateNanoId(),
        email: body.email,
        password: hashedPassword,
        firstName: body.firstName || "",
        lastName: body.lastName || "",
        inviteCode: body.inviteCode || "",
        isEmailVerified: false,
      },
    });

    // Return user without password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {password, ...userWithoutPassword} = user;

    return NextResponse.json(userWithoutPassword, {status: 201});
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({error: "Failed to create user"}, {status: 500});
  }
}
