import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/env";
import { MEDIA_BUCKET, MEDIA_EXT, MEDIA_MAX_BYTES, MEDIA_TYPES, mediaPathFromUrl, sniffImage, type MediaKind } from "@/lib/media";

export type UploadResult = { url: string } | { error: string };

/**
 * Guarda a foto no Storage (bucket público "midia", pasta do negócio).
 * Quem chama já conferiu que o usuário pode editar o negócio. O bucket é criado na primeira vez.
 */
export async function storeBusinessImage(businessId: string, kind: MediaKind, file: unknown): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma foto." };
  if (file.size > MEDIA_MAX_BYTES) return { error: "Foto muito grande. Use uma de até 2 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { error: "Formato não aceito. Use JPG, PNG ou WebP." };

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    console.error("upload de foto: SUPABASE_SERVICE_ROLE_KEY ausente");
    return { error: "Envio de fotos indisponível no momento." };
  }
  const path = `${businessId}/${kind}-${crypto.randomUUID()}.${MEDIA_EXT[type]}`;
  const send = () => db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: type, cacheControl: "31536000", upsert: false });

  let { error } = await send();
  if (error && /bucket not found/i.test(error.message)) {
    await db.storage.createBucket(MEDIA_BUCKET, { public: true, fileSizeLimit: MEDIA_MAX_BYTES, allowedMimeTypes: [...MEDIA_TYPES] });
    ({ error } = await send());
  }
  if (error) {
    console.error("upload de foto falhou", { kind, message: error.message });
    return { error: "Não foi possível enviar a foto agora. Tente de novo." };
  }
  return { url: db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl };
}

/** Apaga uma foto antiga do negócio (só se for nossa e da pasta dele). Falha em silêncio. */
export async function deleteBusinessImage(businessId: string, url: string | null | undefined) {
  const path = mediaPathFromUrl(url, SUPABASE_URL);
  if (!path || !path.startsWith(`${businessId}/`)) return;
  await createServiceClient().storage.from(MEDIA_BUCKET).remove([path]).catch(() => undefined);
}
