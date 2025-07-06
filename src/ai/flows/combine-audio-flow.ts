'use server';
/**
 * @fileOverview An AI agent for combining WAV audio files.
 *
 * - combineAudio - A function that combines multiple WAV audio chunks into one.
 * - CombineAudioInput - The input type for the combineAudio function.
 * - CombineAudioOutput - The return type for the combineAudio function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import wav from 'wav';

const CombineAudioInputSchema = z.array(z.string().describe("A WAV audio file as a data URI. Expected format: 'data:audio/wav;base64,<encoded_data>'."));
export type CombineAudioInput = z.infer<typeof CombineAudioInputSchema>;

const CombineAudioOutputSchema = z.object({
  media: z.string().describe("The combined audio as a WAV data URI. Expected format: 'data:audio/wav;base64,<encoded_data>'."),
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

    if (audioDataUris.length === 1) {
        return { media: audioDataUris[0] };
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

    const combinedPcmData = Buffer.concat(pcmDataChunks);
    
    return new Promise((resolve, reject) => {
      const writer = new wav.Writer(formatInfo);
      const bufs: Buffer[] = [];
      
      writer.on('data', (chunk) => bufs.push(chunk));
      writer.on('end', () => {
        const combinedWavBuffer = Buffer.concat(bufs);
        resolve({
          media: 'data:audio/wav;base64,' + combinedWavBuffer.toString('base64'),
        });
      });
      writer.on('error', reject);

      writer.write(combinedPcmData);
      writer.end();
    });
  }
);
