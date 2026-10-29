import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const MessageSchema = new Schema(
  {
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    text: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "received", "failed"],
      required: true,
    },
    read: { type: Boolean, default: false },
    failureReason: { type: String },
    telnyxMessageId: { type: String, index: true, sparse: true },
    conversationKey: { type: String, index: true },
  },
  { timestamps: true }
);

MessageSchema.index({ status: 1, direction: 1, from: 1, to: 1, date: -1 });

export type IMessage = InferSchemaType<typeof MessageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Message: Model<IMessage> =
  mongoose.models.Message ||
  mongoose.model<IMessage>("Message", MessageSchema);
