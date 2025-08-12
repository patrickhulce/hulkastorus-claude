import {NextRequest, NextResponse} from "next/server";
import {createUser} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.email || !body.password || !body.inviteCode) {
      return NextResponse.json({error: "Missing required fields"}, {status: 400});
    }

    if (body.password.length < 6) {
      return NextResponse.json({error: "Password must be at least 6 characters"}, {status: 400});
    }

    const user = await createUser({
      email: body.email,
      password: body.password,
      firstName: body.firstName || "",
      lastName: body.lastName || "",
      inviteCode: body.inviteCode,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {password, ...userWithoutPassword} = user;

    return NextResponse.json(userWithoutPassword, {status: 201});
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.code === "P2002") {
      return NextResponse.json({error: "Email already exists"}, {status: 400});
    }
    console.error("Error creating user:", error);
    return NextResponse.json({error: "Failed to create user"}, {status: 500});
  }
}
