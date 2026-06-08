import mongoose from 'mongoose';

/** Normalize a raw or populated Mongo ref to a 24-char hex id string. */
export function extractMongoId(ref: unknown): string | undefined {
  if (ref == null) return undefined;
  if (typeof ref === 'string') {
    return mongoose.Types.ObjectId.isValid(ref) ? ref : undefined;
  }
  if (ref instanceof mongoose.Types.ObjectId) {
    return ref.toString();
  }
  if (typeof ref === 'object') {
    if ('_id' in ref && (ref as { _id: unknown })._id != null) {
      return extractMongoId((ref as { _id: unknown })._id);
    }
    if (typeof (ref as { toString?: () => string }).toString === 'function') {
      const s = (ref as { toString: () => string }).toString();
      if (mongoose.Types.ObjectId.isValid(s) && s.length === 24) return s;
    }
  }
  return undefined;
}
