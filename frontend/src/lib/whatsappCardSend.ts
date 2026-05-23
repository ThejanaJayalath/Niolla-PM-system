/** Download greeting card image, then open WhatsApp with text only (user attaches the image). */
export async function openWhatsAppWithCardDownload(
  whatsappDeepLink: string,
  cardImageUrl: string,
  downloadName: string
): Promise<void> {
  let fetchUrl = cardImageUrl;
  if (!fetchUrl.includes('format=')) {
    fetchUrl = fetchUrl.includes('?') ? `${fetchUrl}&format=png` : `${fetchUrl}?format=png`;
  }

  const res = await fetch(fetchUrl);
  if (!res.ok) throw new Error('Could not download the card image');

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = downloadName.endsWith('.png') ? downloadName : `${downloadName}.png`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  window.open(whatsappDeepLink, '_blank', 'noopener,noreferrer');
}
