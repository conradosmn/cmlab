/**
 * Utilitário de processamento e otimização de fotos para o Catálogo CM Casa Criativa.
 * Redimensiona e comprime imagens (Upload, Ctrl+V ou extraídas de .3mf) para WebP/JPEG leve,
 * garantindo sincronização rápida no Supabase entre PC, Laptop, iPad e Celular.
 */

export function getMimeTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

export async function compressDataUrl(
  dataUrl: string,
  maxWidth = 1000,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.fillStyle = "#FAF7F2";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const webpDataUrl = canvas.toDataURL("image/webp", quality);
      if (webpDataUrl.startsWith("data:image/webp")) {
        resolve(webpDataUrl);
      } else {
        resolve(canvas.toDataURL("image/jpeg", quality));
      }
    };
    img.src = dataUrl;
  });
}

export async function compressImageBlobToDataUrl(
  blobOrFile: Blob | File,
  maxWidth = 1000,
  quality = 0.82,
  filenameHint = "image.png"
): Promise<string> {
  const mime = blobOrFile.type || getMimeTypeFromFilename(filenameHint);
  const typedBlob =
    blobOrFile.type === mime
      ? blobOrFile
      : new Blob([blobOrFile], { type: mime });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler arquivo de imagem."));
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      const compressed = await compressDataUrl(rawDataUrl, maxWidth, quality);
      resolve(compressed);
    };
    reader.readAsDataURL(typedBlob);
  });
}
