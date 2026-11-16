// Build Vercel: render ikon PNG dari SVG di folder icons/ ke public/.
import sharp from "sharp";
const jobs = [["icons/logo.svg", "icon-192.png", 192], ["icons/logo.svg", "icon-512.png", 512], ["icons/mask.svg", "icon-maskable-512.png", 512], ["icons/apple.svg", "apple-touch-icon.png", 180]];
for (const [src, out, w] of jobs) await sharp(src).resize(w, w).png({ compressionLevel: 9 }).toFile("public/" + out);
console.log("ikon dibuat:", jobs.map((j) => j[1]).join(", "));
