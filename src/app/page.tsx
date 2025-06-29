"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Terminal, Waves } from "lucide-react";

export default function Home() {
  const [text, setText] = useState(
    "Bonjour, bienvenue sur Chirpify ! Écrivez n'importe quel texte ici et je le lirai pour vous."
  );
  const [languageCode, setLanguageCode] = useState("fr-FR");
  const [voiceName, setVoiceName] = useState("fr-FR-Chirp3-HD-Charon");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    if (!text.trim()) {
      setError("Text to be converted cannot be empty.");
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams({
      text,
      language_code: languageCode,
      voice_name: voiceName,
    });

    const url = `https://backend-api-1008225662928.europe-west9.run.app/stt?${params.toString()}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        let errorText = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorText = errorData.detail || errorText;
        } catch (e) {
          // Response was not JSON, use the status text.
        }
        throw new Error(errorText);
      }

      const blob = await response.blob();
      if (blob.type.includes('audio')) {
        const newAudioUrl = URL.createObjectURL(blob);
        setAudioUrl(newAudioUrl);
      } else {
        throw new Error("The response was not a valid audio file.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during the request.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 font-body">
      <div className="w-full max-w-3xl">
        <Card className="w-full shadow-2xl rounded-2xl">
          <CardHeader className="text-center">
             <div className="flex items-center justify-center gap-4 mb-4">
                <div className="bg-primary p-3 rounded-full flex items-center justify-center">
                <Waves className="h-8 w-8 text-primary-foreground" />
                </div>
            </div>
            <CardTitle className="text-4xl font-headline tracking-tight">
              Chirpify
            </CardTitle>
            <CardDescription className="text-lg">
              Bring your text to life with natural-sounding speech.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 px-8 py-6">
              <div className="space-y-2">
                <Label htmlFor="text" className="text-base">
                  Your Text
                </Label>
                <Textarea
                  id="text"
                  placeholder="Enter the text you want to convert to speech..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  required
                  className="resize-none text-base rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="language-code" className="text-base">
                    Language Code
                  </Label>
                  <Input
                    id="language-code"
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                    placeholder="e.g., fr-FR"
                    className="text-base rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voice-name" className="text-base">
                    Voice Name
                  </Label>
                  <Input
                    id="voice-name"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    placeholder="e.g., fr-FR-Chirp3-HD-Charon"
                    className="text-base rounded-lg"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-4 px-8 pb-8">
              <Button type="submit" disabled={isLoading} size="lg" className="text-lg py-7 rounded-xl font-bold">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Speech"
                )}
              </Button>
              {error && (
                <Alert variant="destructive" className="mt-4 rounded-lg">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Request Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {audioUrl && (
                <div className="mt-6 p-4 border rounded-xl bg-accent/20">
                  <h3 className="font-semibold text-lg mb-3 text-accent-foreground">
                    Listen to your speech
                  </h3>
                  <audio controls src={audioUrl} className="w-full">
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
       <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>Created with passion by a Senior Engineer for Chirpify.</p>
      </footer>
    </main>
  );
}
