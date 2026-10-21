/**
 * Utilitário de processamento e otimização de fotos para o Catálogo CM Casa Criativa.
 * Redimensiona e comprime imagens (Upload, Ctrl+V ou extraídas de .3mf) para WebP/JPEG leve,
 * garantindo sincronização rápida no Supabase entre PC, Laptop, iPad e Celular.
 */

export async function compressImageBlobToDataUrl(
  blobOrFile: Blob | File,
  maxWidth = 1000,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler arquivo de imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem inválido."));
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
          resolve(reader.result as string);
          return;
        }

        // Fundo suave linho caso a imagem tenha transparência (ex: render de placa .3mf)
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
      img.src = reader.result as string;
    };
    reader.readAsDataURL(blobOrFile);
  });
}
