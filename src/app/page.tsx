"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  Terminal,
  Waves,
  ChevronsUpDown,
  Check,
  Download,
  RefreshCcw,
} from "lucide-react";
import { generateSpeech, type GenerateSpeechInput, type GenerateSpeechOutput } from "@/ai/flows/tts-flow";
import { combineAudio } from "@/ai/flows/combine-audio-flow";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

const MAX_CHUNK_LENGTH = 1000;

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const finalChunks: string[] = [];
  if (!text) return finalChunks;

  if (text.length <= maxLength) {
    return [text];
  }

  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      if (currentChunk.length > 0) {
        finalChunks.push(currentChunk.trim());
        currentChunk = "";
      }
      for (let i = 0; i < sentence.length; i += maxLength) {
        finalChunks.push(sentence.substring(i, i + maxLength));
      }
    } else {
      if (currentChunk.length + sentence.length > maxLength) {
        finalChunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
  }

  if (currentChunk.length > 0) {
    finalChunks.push(currentChunk.trim());
  }

  return finalChunks.filter((c) => c.length > 0);
}

async function generateSpeechWithRetry(
  input: GenerateSpeechInput,
  retries: number = 3
): Promise<GenerateSpeechOutput> {
  let lastError: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await generateSpeech(input);
      if (response && response.media) {
        return response;
      }
      throw new Error("API returned a successful response but without media data.");
    } catch (err) {
      lastError = err;
      console.error(`Speech generation attempt ${i + 1} of ${retries} failed.`, err);
      if (i < retries - 1) {
        const delay = 500 * (i + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error(`Speech generation failed after ${retries} retries.`);
}


const languages = [
  { value: "fr-FR", label: "French (France)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Spanish (Spain)" },
];

const voices = [
  { value: "achernar", label: "Achernar", gender: "male" },
  { value: "achird", label: "Achird", gender: "female" },
  { value: "algenib", label: "Algenib", gender: "male" },
  { value: "algieba", label: "Algieba", gender: "male" },
  { value: "alnilam", label: "Alnilam", gender: "female" },
  { value: "aoede", label: "Aoede", gender: "female" },
  { value: "autonoe", label: "Autonoe", gender: "female" },
  { value: "callirrhoe", label: "Callirrhoe", gender: "female" },
  { value: "charon", label: "Charon", gender: "male" },
  { value: "despina", label: "Despina", gender: "female" },
  { value: "enceladus", label: "Enceladus", gender: "male" },
  { value: "erinome", label: "Erinome", gender: "female" },
  { value: "fenrir", label: "Fenrir", gender: "male" },
  { value: "gacrux", label: "Gacrux", gender: "male" },
  { value: "iapetus", label: "Iapetus", gender: "male" },
  { value: "kore", label: "Kore", gender: "female" },
  { value: "laomedeia", label: "Laomedeia", gender: "female" },
  { value: "leda", label: "Leda", gender: "female" },
  { value: "orus", label: "Orus", gender: "male" },
  { value: "puck", label: "Puck", gender: "male" },
  { value: "pulcherrima", label: "Pulcherrima", gender: "female" },
  { value: "rasalgethi", label: "Rasalgethi", gender: "male" },
  { value: "sadachbia", label: "Sadachbia", gender: "female" },
  { value: "sadaltager", label: "Sadaltager", gender: "male" },
  { value: "schedar", label: "Schedar", gender: "female" },
  { value: "sulafat", label: "Sulafat", gender: "male" },
  { value: "umbriel", label: "Umbriel", gender: "female" },
  { value: "vindemiatrix", label: "Vindemiatrix", gender: "female" },
  { value: "zephyr", label: "Zephyr", gender: "male" },
  { value: "zubenelgenubi", label: "Zubenelgenubi", gender: "male" },
];

export default function Home() {
  const [projectName, setProjectName] = useState("");
  const [text, setText] = useState("");
  const [languageCode, setLanguageCode] = useState("fr-FR");
  const [voiceName, setVoiceName] = useState("charon");
  const [gender, setGender] = useState("any");
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [combinedAudioUrl, setCombinedAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCombining, setIsCombining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);

  const filteredVoices = useMemo(() => {
    if (gender === "any") {
      return voices;
    }
    return voices.filter((v) => v.gender === gender);
  }, [gender]);

  useEffect(() => {
    if (voiceName && !filteredVoices.some((v) => v.value === voiceName)) {
      setVoiceName("");
    }
  }, [filteredVoices, voiceName]);

  const handleDownloadAll = async () => {
    if (audioUrls.length === 0 && !combinedAudioUrl) {
      setError("No audio files to download.");
      return;
    }

    const zip = new JSZip();
    const safeProjectName = projectName.trim() || "speech-it-project";

    if (combinedAudioUrl) {
      const combinedBase64 = combinedAudioUrl.split(",")[1];
      zip.file(`${safeProjectName}.wav`, combinedBase64, { base64: true });
    }

    if (audioUrls.length > 1) {
      const partsFolder = zip.folder("parts");
      if (partsFolder) {
        audioUrls.forEach((url, index) => {
          const base64 = url.split(",")[1];
          partsFolder.file(`${safeProjectName}-Part${index + 1}.wav`, base64, {
            base64: true,
          });
        });
      }
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${safeProjectName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      setError(
        err.message ||
          "An unexpected error occurred while creating the zip file."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsCombining(false);
    setError(null);
    setAudioUrls([]);
    setCombinedAudioUrl(null);
    setShowRetryButton(false);

    if (!text.trim()) {
      setError("Text to be converted cannot be empty.");
      setIsLoading(false);
      return;
    }

    if (!voiceName) {
      setError("Please select a voice.");
      setIsLoading(false);
      return;
    }

    try {
      const chunks = splitTextIntoChunks(text, MAX_CHUNK_LENGTH);
      if (chunks.length === 0) {
        setError("Text is too short to be chunked.");
        setIsLoading(false);
        return;
      }

      const chunkUrls: string[] = [];
      for (const chunk of chunks) {
        const response = await generateSpeechWithRetry({
          text: chunk,
          languageCode,
          voiceName,
        });

        if (response.media) {
          chunkUrls.push(response.media);
          setAudioUrls([...chunkUrls]);
        } else {
          throw new Error("A response did not contain valid audio data.");
        }
      }

      if (chunkUrls.length > 1) {
        setIsCombining(true);
        const combined = await combineAudio(chunkUrls);
        if (combined.media) {
          setCombinedAudioUrl(combined.media);
        } else {
          throw new Error("Failed to get combined audio from server.");
        }
      } else if (chunkUrls.length === 1) {
        setCombinedAudioUrl(chunkUrls[0]);
      }
    } catch (err: any) {
      setError(
        err.message || "An unexpected error occurred during the request."
      );
      setShowRetryButton(true);
    } finally {
      setIsLoading(false);
      setIsCombining(false);
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
              Speech-it
            </CardTitle>
            <CardDescription className="text-lg">
              Bring your text to life with natural-sounding speech.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 px-8 py-6">
              <div className="space-y-2">
                <Label htmlFor="projectName" className="text-base">
                  Project Name
                </Label>
                <Input
                  id="projectName"
                  placeholder="Enter a name for your project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-base rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="text" className="text-base">
                  Your Text
                </Label>
                <Textarea
                  id="text"
                  placeholder="Enter the text you want to convert to speech..."
                  value={text}
                  onChange={(e) => {
                    const newText = e.target.value;
                    const oldFirstLine = text.split("\n")[0].trim();
                    const newFirstLine = newText.split("\n")[0].trim();

                    if (projectName === oldFirstLine || projectName === "") {
                      setProjectName(newFirstLine);
                    }
                    setText(newText);
                  }}
                  rows={6}
                  required
                  className="resize-none text-base rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="language" className="text-base">
                    Language
                  </Label>
                  <Select
                    value={languageCode}
                    onValueChange={setLanguageCode}
                    defaultValue="fr-FR"
                  >
                    <SelectTrigger
                      id="language"
                      className="text-base rounded-lg"
                    >
                      <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Voice Name</Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between text-base rounded-lg"
                      >
                        {voiceName
                          ? voices.find((voice) => voice.value === voiceName)
                              ?.label
                          : "Select voice..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search voice..." />
                        <CommandEmpty>No voice found.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {filteredVoices.map((voice) => (
                              <CommandItem
                                key={voice.value}
                                value={voice.value}
                                onSelect={(currentValue) => {
                                  setVoiceName(
                                    currentValue === voiceName
                                      ? ""
                                      : currentValue
                                  );
                                  setOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    voiceName === voice.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {voice.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-base">Voice Gender</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={setGender}
                  className="flex items-center space-x-4 pt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="any" id="gender-any" />
                    <Label htmlFor="gender-any" className="font-normal">
                      Any
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="gender-female" />
                    <Label htmlFor="gender-female" className="font-normal">
                      Female
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="gender-male" />
                    <Label htmlFor="gender-male" className="font-normal">
                      Male
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-4 px-8 pb-8">
              <Button
                type="submit"
                disabled={isLoading}
                size="lg"
                className="text-lg py-7 rounded-xl font-bold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {isCombining ? "Assembling audio..." : "Generating..."}
                  </>
                ) : showRetryButton ? (
                  <>
                    <RefreshCcw className="mr-2 h-6 w-6" />
                    Retry Generation
                  </>
                ) : (
                  "Generate Speech"
                )}
              </Button>
              {(combinedAudioUrl || audioUrls.length > 0) && !isLoading && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleDownloadAll}
                  className="w-full text-lg py-7 rounded-xl font-bold"
                >
                  <Download className="mr-2 h-6 w-6" />
                  Download All Files (.zip)
                </Button>
              )}
              {error && (
                <Alert variant="destructive" className="mt-4 rounded-lg">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Request Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {combinedAudioUrl && (
                <div className="mt-6 p-4 border rounded-xl bg-accent/20">
                  <h3 className="font-semibold text-lg mb-3 text-accent-foreground">
                    Final Assembled Audio
                  </h3>
                  <div className="space-y-4">
                    <audio
                      controls
                      src={combinedAudioUrl}
                      className="w-full mt-1"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                </div>
              )}
              {audioUrls.length > 1 && (
                <div className="mt-6 p-4 border rounded-xl bg-secondary">
                  <h3 className="font-semibold text-lg mb-3 text-secondary-foreground">
                    Audio Parts
                  </h3>
                  <div className="space-y-4">
                    {audioUrls.map((url, index) => (
                      <div key={index}>
                        <Label className="text-sm text-muted-foreground">
                          Part {index + 1}
                        </Label>
                        <audio controls src={url} className="w-full mt-1">
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
      <footer className="mt-8 text-center text-muted-foreground text-sm">
        <p>Created with passion by Julien Miquel {'<julienmiquel@google.com>'}</p>
      </footer>
    </main>
  );
}
