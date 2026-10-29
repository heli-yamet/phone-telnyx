import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export type IContact = InferSchemaType<typeof ContactSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Contact: Model<IContact> =
  mongoose.models.Contact || mongoose.model<IContact>("Contact", ContactSchema);
