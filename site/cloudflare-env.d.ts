declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    FAMILY_AI_BASE_URL?: string;
    FAMILY_AI_API_KEY?: string;
    FAMILY_AI_MODEL?: string;
  }
}
