import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import archiver from 'archiver';
import cors from 'cors'; // Import cors
import Absen from './models/absen.model.js';
import Peserta from './models/peserta.model.js';
import connectDB from './config/dbConfig.js';

connectDB();

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  methods: ["POST"],
  credentials: true,
  origin:'*'
})); // Enable CORS
app.use(express.json()); // To parse JSON request bodies

app.post('/create_sertifikat', async (req, res) => {
  try {
    const xPosition = 840;
    const yPosition = 674;
    const registerXPosition = 1130;
    const registerYPosition = 768;
    const certificatesFolder = path.join(__dirname, 'certificates');
    const templatePath = path.join(__dirname, 'template', 'certificate_temp_icaffa.png');
    const greatVibesFontPath = path.join(__dirname, 'fonts', 'GreatVibes-Regular.ttf');
    const chunkFiveExFontPath = path.join(__dirname, 'fonts', 'Bitter-ExtraBold.ttf');

    // Create certificates folder if it doesn't exist
    if (!fs.existsSync(certificatesFolder)) {
      fs.mkdirSync(certificatesFolder);
    }

    // Register the fonts
    registerFont(greatVibesFontPath, { family: 'Great Vibes' });
    registerFont(chunkFiveExFontPath, { family: 'Bitter' });

    // Fetch participants who were present
    const absentees = await Absen.find({ status_kehadiran: 'hadir' }).populate('participantId');

    // Array to store paths of generated certificates
    const certificateFiles = [];

    // Loop through each participant and create a certificate
    for (const absentee of absentees) {
      const participant = absentee.participantId;
      const registeringAs = `as ${participant.registering_as.charAt(0).toUpperCase() + participant.registering_as.slice(1)}`;

      const templateImage = await loadImage(templatePath);
      const canvas = createCanvas(templateImage.width, templateImage.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(templateImage, 0, 0);

      const nameTextSize = 104;
      ctx.font = `${nameTextSize}px "Great Vibes"`;
      ctx.fillStyle = '#296e5c';

      const nameTextWidth = ctx.measureText(participant.fullname).width;
      const adjustedXPosition = xPosition !== undefined ? parseFloat(xPosition) : (templateImage.width - nameTextWidth) / 2;
      const adjustedYPosition = yPosition !== undefined ? parseFloat(yPosition) : templateImage.height / 2 + nameTextSize / 2;

      ctx.fillText(participant.fullname, adjustedXPosition, adjustedYPosition);

      const registerTextSize = 52;
      ctx.font = `${registerTextSize}px "Bitter"`;
      ctx.fillStyle = '#000000';

      const registerTextWidth = ctx.measureText(registeringAs).width;
      const adjustedRegisterXPosition = registerXPosition !== undefined ? parseFloat(registerXPosition) : (templateImage.width - registerTextWidth) / 2;
      const adjustedRegisterYPosition = registerYPosition !== undefined ? parseFloat(registerYPosition) : adjustedYPosition + 80;

      ctx.fillText(registeringAs, adjustedRegisterXPosition, adjustedRegisterYPosition);

      const outputImage = path.join(certificatesFolder, `${participant.fullname.replace(/ /g, '_')}.png`);
      const outputStream = fs.createWriteStream(outputImage);
      const stream = canvas.createPNGStream();
      stream.pipe(outputStream);

      // Push the file path to the certificateFiles array
      certificateFiles.push(outputImage);
    }

    // Create a zip file and add all certificates
    const zipFileName = 'certificates.zip';
    const zipFilePath = path.join(certificatesFolder, zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipFilePath, zipFileName, (err) => {
        if (err) {
          console.error('Error downloading zip file:', err);
          res.status(500).json({ message: 'Error downloading zip file' });
        }
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // Append files to the zip archive
    certificateFiles.forEach((file) => {
      archive.file(file, { name: path.basename(file) });
    });

    await archive.finalize();
  } catch (error) {
    console.error('Error creating certificates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(process.env.APP_PORT, () => console.log('Server started on port', process.env.APP_PORT));
