import { connectDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Contact } from "@/models/Contact";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as {
      name?: string;
      phoneNumber?: string;
    };
    const updates: { name?: string; phoneNumber?: string } = {};
    if (body.name?.trim()) updates.name = body.name.trim();
    if (body.phoneNumber) updates.phoneNumber = normalizePhone(body.phoneNumber);

    await connectDb();
    const contact = await Contact.findByIdAndUpdate(
      context.params.id,
      updates,
      { new: true }
    );

    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      contact: {
        id: contact._id.toString(),
        name: contact.name,
        phoneNumber: contact.phoneNumber,
      },
    });
  } catch (error) {
    console.error("Update contact error:", error);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    await connectDb();
    const contact = await Contact.findByIdAndDelete(context.params.id);
    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete contact error:", error);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
