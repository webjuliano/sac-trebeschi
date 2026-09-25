/**
 * Reduz a resolução e a qualidade da foto no navegador antes do envio,
 * para o arquivo gravado ficar leve sem perder a leitura do defeito.
 */
export async function comprimirImagem(
  file: File,
  maxLado = 1400,
  qualidade = 0.68,
): Promise<{ base64: string; nome: string; bytes: number; hash: string }> {
  // Impressão digital do arquivo original, para detectar fotos repetidas.
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", qualidade);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return {
    base64,
    hash,
    nome: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    bytes: Math.round((base64.length * 3) / 4),
  };
}
