// Reduce una imagen (data URL) para que su lado mayor no pase de maxPx,
// conservando la transparencia (PNG). Los reportes PDF y Excel la muestran
// de 1 a 3 cm: incrustar el logo original de 1254 px hacía que un PDF de una
// sola página pesara más de 6 MB. Si algo falla, devuelve la imagen original.
export function reducirImagen(dataUrl, maxPx = 200) {
  if (!dataUrl) return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maxPx / Math.max(img.width, img.height));
      if (escala === 1) return resolve(dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
