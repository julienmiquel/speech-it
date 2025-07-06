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
import * as lamejs from 'lamejs';

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
    
    let combinedWavBuffer: Buffer;

    if (buffers.length === 1) {
      combinedWavBuffer = buffers[0];
    } else {
      const HEADER_LENGTH = 44;
      const header = buffers[0].slice(0, HEADER_LENGTH);
      const audioData = buffers.map(buffer => buffer.slice(HEADER_LENGTH));
      const combinedAudioData = Buffer.concat(audioData);
      const newHeader = Buffer.from(header);
      newHeader.writeUInt32LE(combinedAudioData.length, 40);
      newHeader.writeUInt32LE(36 + combinedAudioData.length, 4);
      combinedWavBuffer = Buffer.concat([newHeader, combinedAudioData]);
    }

    const reader = new wav.Reader();
    const pcmData: Buffer[] = [];
    let formatInfo: any = {};

    return new Promise<CombineAudioOutput>((resolve, reject) => {
      reader.on('format', (format) => {
        formatInfo = format;
        if (format.channels > 2) {
            return reject(new Error('Cannot encode audio with more than 2 channels.'));
        }
      });

      reader.on('data', (chunk) => {
        pcmData.push(chunk);
      });

      reader.on('end', () => {
        try {
          const pcmBuffer = Buffer.concat(pcmData);
          const int16Pcm = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / Int16Array.BYTES_PER_ELEMENT);

          const mp3Encoder = new lamejs.Mp3Encoder(formatInfo.channels, formatInfo.sampleRate, 128);
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
          
          resolve({
            media: 'data:audio/mpeg;base64,' + mp3Buffer.toString('base64'),
          });
        } catch(err: any) {
          reject(new Error(`MP3 encoding failed: ${err.message}`));
        }
      });

      reader.on('error', (err) => {
        reject(new Error(`Error reading combined WAV buffer: ${err.message}`));
      });

      reader.end(combinedWavBuffer);
    });
  }
);
