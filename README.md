# Speech-it: Text-to-Speech Application

This is a Text-to-Speech (TTS) application built with Next.js and Firebase Studio. It leverages Google's generative AI models through Genkit to convert text into natural-sounding speech, with a robust workflow for handling long texts and potential errors.

## Features

- **Text-to-Speech Conversion**: Enter any text and have it read aloud.
- **Voice & Language Selection**: Choose from a variety of male and female voices and select the language.
- **Automatic Project Naming**: Suggests a project name based on the first line of your text.
- **Reliable Chunking for Long Texts**: Automatically splits long texts into smaller chunks to ensure reliable API processing.
- **Sequential Audio Generation**: Generates and displays audio for each chunk as it becomes available.
- **Combined Audio**: Seamlessly assembles all audio chunks into a single, final playable audio file.
- **Downloadable Project Files**: Download a `.zip` file containing the final combined audio and all individual parts, conveniently named after your project.
- **Robust Error Handling**: Includes an automatic retry mechanism and a manual retry option for failed generations.

## Tech Stack

- [Next.js](https://nextjs.org/) (React Framework)
- [Genkit](https://firebase.google.com/docs/genkit) (AI Framework)
- [ShadCN UI](https://ui.shadcn.com/) (Component Library)
- [Tailwind CSS](https://tailwindcss.com/) (CSS Framework)
- [TypeScript](https://www.typescriptlang.org/)

## Architecture

The application is built on a modern, server-centric architecture using Next.js and Genkit.

- **Frontend**: A Next.js application using the App Router. It's responsible for the user interface, state management (using React hooks), and user interactions. Components are built with ShadCN UI and styled with Tailwind CSS.

- **Backend (AI Flows)**: The backend logic is encapsulated in Genkit flows, which are run as Next.js Server Actions. This approach avoids exposing API keys to the client and handles CORS issues by proxying all external API calls through the server.
  - `tts-flow.ts`: Handles the conversion of a single text chunk to speech.
  - `combine-audio-flow.ts`: Merges multiple audio chunks into a single WAV file.

- **AI Model**: The core TTS functionality is powered by Google's `gemini-2.5-flash-preview-tts` model, accessed via the `@genkit-ai/googleai` plugin.

## Application Workflow

The process from text input to final audio output follows these steps:

1.  **Input**: The user enters text into the textarea on the main page.
2.  **Chunking**: The client-side logic in `page.tsx` splits the input text into smaller chunks, each under a configurable maximum length (`MAX_CHUNK_LENGTH`).
3.  **Concurrent Generation**: The client iterates through the chunks and calls the `generateSpeech` server action for each one.
4.  **Speech Synthesis**: The `generateSpeechFlow` on the server receives the text chunk, calls the Google Gemini TTS model to get raw PCM audio data, converts it to the WAV format, and returns it as a Base64-encoded data URI.
5.  **UI Update**: As each audio chunk is successfully generated, its corresponding `<audio>` player is rendered on the page, allowing the user to see progress in real-time.
6.  **Audio Combination**: Once all individual chunks have been processed, the client calls the `combineAudio` server action, sending the data URIs of all the generated parts.
7.  **Final Assembly**: The `combineAudioFlow` on the server decodes the WAV files, concatenates their audio data, and constructs a new, valid WAV header for the combined file. This final audio is returned as a data URI.
8.  **Playback & Download**: The final assembled audio is displayed in a prominent player. A "Download All" button allows the user to save a `.zip` archive containing the final track and all its constituent parts.

## Error Handling and Failover

To ensure a reliable user experience, the application includes several layers of error handling:

- **API-Friendly Chunking**: By splitting text into small pieces, the application avoids potential timeouts or payload size limits of the TTS API.
- **Automatic Client-Side Retries**: The `generateSpeechWithRetry` function in `page.tsx` attempts to generate speech for a chunk up to 3 times if an error occurs, with an increasing delay between attempts.
- **Manual Retry Option**: If all automatic retries fail for any part of the generation process, the main "Generate Speech" button transforms into a "Retry Generation" button, giving the user control to restart the process.
- **User Feedback**: Any unrecoverable errors are caught and displayed in a descriptive alert box, informing the user about the failure.

## Getting Started

To run the application locally:

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the development server:**
    The application requires two processes to run concurrently: the Next.js frontend and the Genkit development server for the AI flows.

    In one terminal, start the Next.js app:
    ```bash
    npm run dev
    ```

    In another terminal, start the Genkit development server:
    ```bash
    npm run genkit:watch
    ```

3.  **Open your browser** to [http://localhost:9002](http://localhost:9002) to see the application in action.

## File Structure

- `src/app/page.tsx`: The main component for the user interface and client-side logic.
- `src/ai/flows/`: Contains the Genkit flows that handle server-side AI tasks.
  - `tts-flow.ts`: Flow for converting text to speech.
  - `combine-audio-flow.ts`: Flow for assembling audio chunks.
- `src/components/ui/`: Reusable UI components from ShadCN.
