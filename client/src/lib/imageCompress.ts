// Client-side image compression: scales an image down to a max dimension and
// encodes it as a JPEG data URL, lowering quality until it fits a target size.
// Used for studio photo pins on the facility map.
export function compressImage(file: File, max = 1000, target = 600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        if (width >= height) {
          height = Math.round((height * max) / width);
          width = max;
        } else {
          width = Math.round((width * max) / height);
          height = max;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      let quality = 0.75;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > target && quality > 0.2) {
        quality = Math.round((quality - 0.07) * 100) / 100;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}
