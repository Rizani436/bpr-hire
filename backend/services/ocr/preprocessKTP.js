import sharp from "sharp";

export const preprocessKTP = async (inputPath) => {
  const outputPath = inputPath.replace(/\.(jpg|jpeg|png)$/i, "_clean.jpg");

  await sharp(inputPath)
    .resize({ width: 2000 })
    .grayscale()
    .normalize()
    .threshold(160)
    .toFile(outputPath);

  return outputPath;
};
