'use server';
/**
 * @fileOverview A text-to-speech AI agent.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 * - GenerateSpeechInput - The input type for the generateSpeech function.
 * - GenerateSpeechOutput - The return type for the generateSpeech function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';

const SpeakerConfigSchema = z.object({
  speaker: z.string().describe("The name of the speaker (e.g., 'Speaker1') to be used in the prompt."),
  voiceName: z.string().describe('The prebuilt voice name to use for this speaker.'),
});

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to convert to speech. For multi-speaker, use speaker tags (e.g., "Speaker1: Hello.").'),
  speakers: z.array(SpeakerConfigSchema).describe("Configuration for each speaker's voice."),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  media: z.string().describe("The generated audio as a data URI. Expected format: 'data:audio/wav;base64,<encoded_data>'."),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;

export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
  return generateSpeechFlow(input);
}

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: Buffer[] = [];
    writer.on('error', reject);
    writer.on('data', function (d: Buffer) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

const generateSpeechFlow = ai.defineFlow(
  {
    name: 'generateSpeechFlow',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async ({ text, speakers }) => {
    let speechConfig: any;

    if (speakers && speakers.length > 1) {
      // Multi-speaker configuration
      speechConfig = {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakers.map(({ speaker, voiceName }) => ({
            speaker,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          })),
        },
      };
    } else {
      // Single-speaker configuration (or fallback)
      const voiceName = speakers && speakers.length === 1 ? speakers[0].voiceName : 'charon'; // Default voice
      speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      };
    }

    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig,
      },
      prompt: text,
    });
    
    if (!media) {
      throw new Error('No audio media returned from the model.');
    }
    
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    const wavBase64 = await toWav(audioBuffer);
    
    return {
      media: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);
