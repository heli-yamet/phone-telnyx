import { connectDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Contact } from "@/models/Contact";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDb();
    const contacts = await Contact.find().sort({ name: 1 });
    return NextResponse.json({
      contacts: contacts.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        phoneNumber: c.phoneNumber,
      })),
    });
  } catch (error) {
    console.error("List contacts error:", error);
    return NextResponse.json({ error: "Failed to load contacts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      phoneNumber?: string;
    };
    const name = body.name?.trim();
    const phoneNumber = body.phoneNumber
      ? normalizePhone(body.phoneNumber)
      : "";

    if (!name || !phoneNumber) {
      return NextResponse.json(
        { error: "name and phoneNumber are required" },
        { status: 400 }
      );
    }

    await connectDb();
    const contact = await Contact.create({ name, phoneNumber });

    return NextResponse.json({
      contact: {
        id: contact._id.toString(),
        name: contact.name,
        phoneNumber: contact.phoneNumber,
      },
    });
  } catch (error) {
    console.error("Create contact error:", error);
    return NextResponse.json(
      { error: "Failed to create contact (duplicate number?)" },
      { status: 400 }
    );
  }
}
