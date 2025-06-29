# Speech-it: Text-to-Speech Application

This is a Text-to-Speech (TTS) application built with Next.js and Firebase Studio. It leverages Google's generative AI models through Genkit to convert text into natural-sounding speech.

## Features

- **Text-to-Speech Conversion**: Enter any text and have it read aloud.
- **Voice Selection**: Choose from a variety of male and female voices across different languages.
- **Chunking for Long Texts**: The application automatically splits long texts into smaller chunks to ensure reliable processing.
- **Combined Audio**: All audio chunks are seamlessly assembled into a single playable audio file.
- **Project Naming**: Give your audio projects a custom name.
- **Downloadable Files**: Download a `.zip` file containing the final combined audio and all individual parts.

## Tech Stack

- [Next.js](https://nextjs.org/) (React Framework)
- [Genkit](https://firebase.google.com/docs/genkit) (AI Framework)
- [ShadCN UI](https://ui.shadcn.com/) (Component Library)
- [Tailwind CSS](https://tailwindcss.com/) (CSS Framework)
- [TypeScript](https://www.typescriptlang.org/)

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

The main application logic can be found in `src/app/page.tsx`, and the AI flows are located in `src/ai/flows/`.
