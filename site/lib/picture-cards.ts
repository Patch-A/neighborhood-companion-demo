export const PICTURE_CARDS = [
  {id: 'miss-you', label: '想见你', hint: '想和熟悉的家人见面', scene: 'together'},
  {id: 'photo', label: '看看照片', hint: '想看看家人的照片', scene: 'photo'},
  {id: 'walk', label: '一起走走', hint: '想一起出去走走', scene: 'walk'},
  {id: 'hello', label: '和你打招呼', hint: '向家人打招呼', scene: 'hello'},
  {id: 'again', label: '没看懂', hint: '请换个方式再说明', scene: 'again'},
  {id: 'later', label: '晚点联系', hint: '现在不方便，稍后再联系', scene: 'later'},
] as const;
export type CardId = typeof PICTURE_CARDS[number]['id'];
export type FamilyRole = 'family' | 'elder';
export type FamilyMember = {userId: string; name: string; role: FamilyRole; avatarId: string | null};
export type FamilyMessage = {
  id: string; senderId: string; recipientId: string; clientId: string; cards: CardId[];
  text: string; mediaIds: string[]; replyTo: string | null; sentAt: string;
  receivedAt: string | null; openedAt: string | null; withdrawnAt: string | null;
  media: {id: string; kind: 'image' | 'audio'}[];
};
export type FamilySnapshot = {
  viewer: {userId: string} | null;
  household: {id: string; name: string; ownerId: string; cardsReviewed: boolean} | null;
  members: FamilyMember[]; messages: FamilyMessage[];
  aiAvailable: boolean; aiProvider?: string; retentionDays: number;
};
export const RETENTION_DAYS = 30;
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_HOUSEHOLD_MEMBERS = 6;
export class FamilyError extends Error {
  constructor(message: string, public status = 400) {super(message);}
}
export function cleanText(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new FamilyError(`请填写${required ? '1–' : '不超过 '}${max} 字的内容。`);
  }
  return value.trim();
}
export function cardIds(value: unknown): CardId[] {
  if (!Array.isArray(value) || value.length > 3 || !value.every(id => PICTURE_CARDS.some(c => c.id === id))) {
    throw new FamilyError('请选择最多 3 张已有图卡。');
  }
  return [...new Set(value)] as CardId[];
}
export function ids(value: unknown, max = 4): string[] {
  if (!Array.isArray(value) || value.length > max || !value.every(id => typeof id === 'string' && /^[a-f\d-]{36}$/i.test(id))) {
    throw new FamilyError('附件或记录编号不正确。');
  }
  return [...new Set(value)] as string[];
}
export function checkMutation(request: Request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
    throw new FamilyError('请从本站完成这个操作。', 403);
  }
}
export async function jsonBody(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new FamilyError('提交格式不正确。', 415);
  if(Number(request.headers.get('content-length'))>12000)throw new FamilyError('提交内容过长。',413);
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let length=0;
  if(reader)try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;
    if(length>12000){await reader.cancel();throw new FamilyError('提交内容过长。',413);}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=new TextDecoder().decode(bytes);
  // Consume the bounded body before returning a CSRF rejection; no dangling upload.
  checkMutation(request);
  let value: unknown;
  try {value = JSON.parse(body);} catch {throw new FamilyError('提交内容无法读取。');}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FamilyError('提交内容无法读取。');
  return value as Record<string, unknown>;
}
export function mediaType(bytes: Uint8Array, declared: string): {mime: string; kind: 'image' | 'audio'} {
  const mime = declared.split(';')[0].toLowerCase();
  const prefix = (values: number[]) => values.every((v,i) => bytes[i] === v);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start,start + length));
  const valid = (mime === 'image/jpeg' && prefix([255,216,255])) ||
    (mime === 'image/png' && prefix([137,80,78,71,13,10,26,10])) ||
    (mime === 'image/webp' && ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') ||
    (mime === 'audio/webm' && prefix([26,69,223,163])) ||
    (mime === 'audio/ogg' && ascii(0,4) === 'OggS') ||
    (mime === 'audio/mp4' && ascii(4,4) === 'ftyp');
  if (!valid) throw new FamilyError('文件格式不支持。照片请用 JPG、PNG、WebP，语音请在页面中录制。',415);
  return {mime, kind: mime.startsWith('image/') ? 'image' : 'audio'};
}
export function messageStatus(message: FamilyMessage) {
  if (message.withdrawnAt) return '已撤回';
  if (message.openedAt) return '对方已打开';
  if (message.receivedAt) return '已到达对方设备';
  return '已保存，等对方上线';
}
