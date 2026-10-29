import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const DetailSchema = new Schema(
  {
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    eventId: { type: String, index: true, sparse: true },
    telnyxMessageId: { type: String, index: true, sparse: true },
    raw: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export type IDetail = InferSchemaType<typeof DetailSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Detail: Model<IDetail> =
  mongoose.models.Detail || mongoose.model<IDetail>("Detail", DetailSchema);
