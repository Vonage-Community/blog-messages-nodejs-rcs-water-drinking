import dotenv from 'dotenv';
import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const privateKeyFile = process.env.VONAGE_PRIVATE_KEY_PATH ;

export const key = readFileSync(privateKeyFile).toString();

export const auth = new Auth({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: key,
});

export const vonage = new Vonage(auth);
