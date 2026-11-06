import mongoose, { Schema } from 'mongoose';

const WebhookLogSchema = new Schema({
  summary: { type: String },
  payload: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // 24h TTL
});

export default mongoose.models.WebhookLog || mongoose.model('WebhookLog', WebhookLogSchema);
