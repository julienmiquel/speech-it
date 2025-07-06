'use server';
/**
 * @fileOverview An AI agent for combining audio files and encoding to MP3.
 *
 * - combineAudio - A function that combines multiple WAV audio chunks into one MP3.
 * - CombineAudioInput - The input type for the combineAudio function.
 * - CombineAudioOutput - The return type for the combineAudio function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import wav from 'wav';
// Use require for lamejs to ensure it loads correctly on the server
const lame = require('lamejs');

const CombineAudioInputSchema = z.array(z.string().describe("A WAV audio file as a data URI. Expected format: 'data:audio/wav;base64,<encoded_data>'."));
export type CombineAudioInput = z.infer<typeof CombineAudioInputSchema>;

const CombineAudioOutputSchema = z.object({
  media: z.string().describe("The combined audio as an MP3 data URI. Expected format: 'data:audio/mpeg;base64,<encoded_data>'."),
});
export type CombineAudioOutput = z.infer<typeof CombineAudioOutputSchema>;


export async function combineAudio(input: CombineAudioInput): Promise<CombineAudioOutput> {
  return combineAudioFlow(input);
}

const combineAudioFlow = ai.defineFlow(
  {
    name: 'combineAudioFlow',
    inputSchema: CombineAudioInputSchema,
    outputSchema: CombineAudioOutputSchema,
  },
  async (audioDataUris) => {
    if (audioDataUris.length === 0) {
      throw new Error("Cannot combine audio from an empty list.");
    }

    const buffers = audioDataUris.map(uri => Buffer.from(uri.substring(uri.indexOf(',') + 1), 'base64'));

    let formatInfo: any = null;
    const pcmDataChunks: Buffer[] = [];

    // Process each buffer to extract PCM data and check format consistency
    for (const buffer of buffers) {
        await new Promise<void>((resolve, reject) => {
            const reader = new wav.Reader();
            reader.on('format', (format) => {
                if (!formatInfo) {
                    formatInfo = format;
                } else if (format.channels !== formatInfo.channels || format.sampleRate !== formatInfo.sampleRate || format.bitDepth !== formatInfo.bitDepth) {
                    return reject(new Error('All audio chunks must have the same format.'));
                }
            });

            reader.on('data', (chunk) => {
                pcmDataChunks.push(chunk);
            });

            reader.on('end', () => resolve());
            reader.on('error', (err) => reject(new Error(`Error reading WAV buffer: ${err.message}`)));
            reader.end(buffer);
        });
    }

    if (!formatInfo) {
        throw new Error("Could not read audio format information from any of the chunks.");
    }
    if (formatInfo.channels > 2) {
        throw new Error('Cannot encode audio with more than 2 channels.');
    }

    const combinedPcmBuffer = Buffer.concat(pcmDataChunks);
    const int16Pcm = new Int16Array(combinedPcmBuffer.buffer, combinedPcmBuffer.byteOffset, combinedPcmBuffer.length / Int16Array.BYTES_PER_ELEMENT);

    try {
        const mp3Encoder = new lame.Mp3Encoder(formatInfo.channels, formatInfo.sampleRate, 128); // 128 kbps bitrate
        const mp3Data: Buffer[] = [];
        const sampleBlockSize = 1152; 

        for (let i = 0; i < int16Pcm.length; i += sampleBlockSize * formatInfo.channels) {
            const end = i + sampleBlockSize * formatInfo.channels;
            const sampleChunk = int16Pcm.subarray(i, end);
            
            let mp3buf: Int8Array;

            if (formatInfo.channels === 1) {
              mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
            } else {
              const left = new Int16Array(sampleChunk.length / 2);
              const right = new Int16Array(sampleChunk.length / 2);
              for (let j = 0; j < sampleChunk.length / 2; j++) {
                left[j] = sampleChunk[j * 2];
                right[j] = sampleChunk[j * 2 + 1];
              }
              mp3buf = mp3Encoder.encodeBuffer(left, right);
            }
            
            if (mp3buf.length > 0) {
              mp3Data.push(Buffer.from(mp3buf));
            }
        }
        const mp3buf = mp3Encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(Buffer.from(mp3buf));
        }

        const mp3Buffer = Buffer.concat(mp3Data);
        
        return {
            media: 'data:audio/mpeg;base64,' + mp3Buffer.toString('base64'),
        };
    } catch(err: any) {
        throw new Error(`MP3 encoding failed: ${err.message}`);
    }
  }
);
