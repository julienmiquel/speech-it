
"use client";

import { useState, useMemo } from "react";
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
  AlertCircle,
  CircleCheck,
  Plus,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

const MAX_CHUNK_LENGTH = 1000;

interface GenerationPart {
  id: number;
  text: string;
  status: 'pending' | 'generating' | 'success' | 'error';
  audioUrl?: string;
}

interface Speaker {
  id: number;
  name: string;
  voiceName: string;
}

// Helper function to split text by a maximum length, respecting sentence boundaries where possible.
function splitByLength(text: string, maxLength: number): string[] {
  const finalChunks: string[] = [];
  if (!text) return finalChunks;

  // No need to split if it's already short enough
  if (text.length <= maxLength) {
    return [text];
  }

  // Attempt to split by sentences first
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [];
  let currentChunk = "";

  for (const sentence of sentences) {
    // If a single sentence is longer than the max length, hard-split it
    if (sentence.length > maxLength) {
      if (currentChunk.length > 0) {
        finalChunks.push(currentChunk.trim());
        currentChunk = "";
      }
      for (let i = 0; i < sentence.length; i += maxLength) {
        finalChunks.push(sentence.substring(i, i + maxLength));
      }
    } else {
      // If adding the next sentence exceeds max length, push the current chunk
      if (currentChunk.length + sentence.length > maxLength) {
        finalChunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
  }

  // Add the last remaining chunk
  if (currentChunk.length > 0) {
    finalChunks.push(currentChunk.trim());
  }

  return finalChunks.filter((c) => c.length > 0);
}

function splitTextIntoChunks(
  text: string,
  option: 'length' | 'scene' | 'speaker',
  config: { maxLength: number; speakerNames: string[] }
): string[] {
  if (!text) return [];

  let initialChunks: string[];

  switch (option) {
    case 'scene':
      // Split by #SCENE followed by a number
      initialChunks = text
        .split(/(?=#SCENE \d+)/i)
        .map((s) => s.trim())
        .filter(Boolean);
      break;

    case 'speaker': {
      // Don't split by speaker if there's only one speaker defined
      if (config.speakerNames.length < 2) {
        initialChunks = [text.trim()];
      } else {
        const speakerNamesPattern = config.speakerNames.join('|');
        // Look for speaker name at the beginning of a line, followed by a colon
        const speakerRegex = new RegExp(`(?=\\b(${speakerNamesPattern})\\b:)`, 'i');
        initialChunks = text
          .split(speakerRegex)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      break;
    }

    case 'length':
    default:
      // If the primary option is by length, just use the helper and return
      return splitByLength(text, config.maxLength);
  }
  
  // For 'scene' and 'speaker' splits, further divide any chunks that are too long
  const finalChunks = initialChunks.flatMap(chunk => 
    chunk.length > config.maxLength 
      ? splitByLength(chunk, config.maxLength) 
      : chunk
  );

  return finalChunks.filter(Boolean);
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
    } catch (err: any) {
      lastError = err;
       // If it's a quota error, don't retry. Fail immediately.
      if (err.message && (err.message.includes('429') || err.message.toLowerCase().includes('quota'))) {
        throw err;
      }

      console.error(`Speech generation attempt ${i + 1} of ${retries} failed.`, err);
      if (i < retries - 1) {
        const delay = 500 * (i + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error(`Speech generation failed after ${retries} retries.`);
}

const voices = [
  { value: "achernar", label: "Achernar", description: "Soft" },
  { value: "achird", label: "Achird", description: "Friendly" },
  { value: "algenib", label: "Algenib", description: "Gravelly" },
  { value: "algieba", label: "Algieba", description: "Smooth" },
  { value: "alnilam", label: "Alnilam", description: "Firm" },
  { value: "aoede", label: "Aoede", description: "Breezy" },
  { value: "autonoe", label: "Autonoe", description: "Bright" },
  { value: "callirrhoe", label: "Callirrhoe", description: "Easy-going" },
  { value: "charon", label: "Charon", description: "Informative" },
  { value: "despina", label: "Despina", description: "Smooth" },
  { value: "enceladus", label: "Enceladus", description: "Breathy" },
  { value: "erinome", label: "Erinome", description: "Clear" },
  { value: "fenrir", label: "Fenrir", description: "Excitable" },
  { value: "gacrux", label: "Gacrux", description: "Mature" },
  { value: "iapetus", label: "Iapetus", description: "Clear" },
  { value: "kore", label: "Kore", description: "Firm" },
  { value: "laomedeia", label: "Laomedeia", description: "Upbeat" },
  { value: "leda", label: "Leda", description: "Youthful" },
  { value: "orus", label: "Orus", description: "Firm" },
  { value: "puck", label: "Puck", description: "Upbeat" },
  { value: "pulcherrima", label: "Pulcherrima", description: "Forward" },
  { value: "rasalgethi", label: "Rasalgethi", description: "Informative" },
  { value: "sadachbia", label: "Sadachbia", description: "Lively" },
  { value: "sadaltager", label: "Sadaltager", description: "Knowledgeable" },
  { value: "schedar", label: "Schedar", description: "Even" },
  { value: "sulafat", label: "Sulafat", description: "Warm" },
  { value: "umbriel", label: "Umbriel", description: "Easy-going" },
  { value: "vindemiatrix", label: "Vindemiatrix", description: "Gentle" },
  { value: "zephyr", label: "Zephyr", description: "Bright" },
  { value: "zubenelgenubi", label: "Zubenelgenubi", description: "Casual" },
];

const models = [
  { value: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash TTS (Recommended)" },
  { value: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro TTS" },
  { value: "gemini-2.5-flash-preview-native-audio-dialog", label: "Gemini 2.5 Flash Native Audio Dialog" },
  { value: "gemini-2.5-flash-exp-native-audio-thinking-dialog", label: "Gemini 2.5 Flash Exp Native Audio Thinking Dialog" },
];

export default function Home() {
  const [projectName, setProjectName] = useState("");
  const [text, setText] = useState("");
  const [speakers, setSpeakers] = useState<Speaker[]>([
    { id: Date.now(), name: "Speaker1", voiceName: "charon" },
  ]);
  const [generationParts, setGenerationParts] = useState<GenerationPart[]>([]);
  const [combinedAudioUrl, setCombinedAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCombining, setIsCombining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);
  const [modelName, setModelName] = useState("gemini-2.5-flash-preview-tts");
  const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false);
  const [splitOption, setSplitOption] = useState<'length' | 'scene' | 'speaker'>('length');

  const hasFailures = useMemo(() => generationParts.some(p => p.status === 'error'), [generationParts]);
  const successfulParts = useMemo(() => generationParts.filter(p => p.status === 'success'), [generationParts]);
  const isFormEmpty = !text && !projectName && generationParts.length === 0 && !combinedAudioUrl;

  const handleClear = () => {
    setProjectName("");
    setText("");
    setSpeakers([{ id: Date.now(), name: "Speaker1", voiceName: "charon" }]);
    setGenerationParts([]);
    setCombinedAudioUrl(null);
    setError(null);
    setIsLoading(false);
    setIsCombining(false);
  };

  const addSpeaker = () => {
    setSpeakers([
      ...speakers,
      {
        id: Date.now(),
        name: `Speaker${speakers.length + 1}`,
        voiceName: "puck", // A different default for variety
      },
    ]);
  };

  const removeSpeaker = (id: number) => {
    if (speakers.length > 1) {
      setSpeakers(speakers.filter((s) => s.id !== id));
    }
  };

  const updateSpeaker = (id: number, field: 'name' | 'voiceName', value: string) => {
    setSpeakers(
      speakers.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleDownloadAll = async () => {
    if (successfulParts.length === 0 && !combinedAudioUrl) {
      setError("No audio files to download.");
      return;
    }

    const zip = new JSZip();
    const safeProjectName = projectName.trim() || "speech-it-project";

    if (combinedAudioUrl) {
      const combinedBase64 = combinedAudioUrl.split(",")[1];
      zip.file(`${safeProjectName}.wav`, combinedBase64, { base64: true });
    }

    const audioUrls = successfulParts.map(p => p.audioUrl!);
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
    setCombinedAudioUrl(null);

    if (!text.trim()) {
      setError("Text to be converted cannot be empty.");
      setIsLoading(false);
      return;
    }
    if (speakers.some(s => !s.voiceName)) {
      setError("Please select a voice for every speaker.");
      setIsLoading(false);
      return;
    }
     if (!modelName.trim()) {
      setError("TTS Model cannot be empty.");
      setIsLoading(false);
      return;
    }

    const chunks = splitTextIntoChunks(text, splitOption, { maxLength: MAX_CHUNK_LENGTH, speakerNames: speakers.map(s => s.name) });

    const partsToProcess = hasFailures
      ? generationParts.map(p => (p.status === 'error' ? { ...p, status: 'pending' } : p))
      : chunks.map((chunk, index) => ({
          id: index,
          text: chunk,
          status: 'pending' as 'pending',
          audioUrl: undefined,
        }));
    
    if (partsToProcess.length === 0 && !hasFailures) {
      setError("Text is too short to be chunked.");
      setIsLoading(false);
      return;
    }

    setGenerationParts(partsToProcess);

    const updatedParts = [...partsToProcess];
    let anyFailuresThisRun = false;
    
    const speakerConfigs = speakers.map(s => ({ speaker: s.name, voiceName: s.voiceName }));

    for (let i = 0; i < updatedParts.length; i++) {
      if (updatedParts[i].status === 'success') {
        continue;
      }

      updatedParts[i] = { ...updatedParts[i], status: 'generating' };
      setGenerationParts([...updatedParts]);

      try {
        const response = await generateSpeechWithRetry({
          text: updatedParts[i].text,
          speakers: speakerConfigs,
          modelName: modelName,
        });

        if (response.media) {
          updatedParts[i] = { ...updatedParts[i], status: 'success', audioUrl: response.media };
        } else {
          throw new Error("A response did not contain valid audio data.");
        }
      } catch (err: any) {
        anyFailuresThisRun = true;
        updatedParts[i] = { ...updatedParts[i], status: 'error', audioUrl: undefined };
        console.error(`Error generating speech for part ${i + 1}:`, err);

        if (err.message && (err.message.includes('429') || err.message.toLowerCase().includes('quota'))) {
            setError("API quota exceeded. Generation has been stopped. Please check your plan or try again later.");
            // Mark remaining parts as errored so the user knows they weren't processed
            for (let j = i + 1; j < updatedParts.length; j++) {
                if (updatedParts[j].status !== 'success') {
                    updatedParts[j] = { ...updatedParts[j], status: 'error' };
                }
            }
            setGenerationParts([...updatedParts]);
            break; // Stop the generation loop
        } else {
            setError(err.message || `An error occurred generating part ${i + 1}.`);
        }
      }
      setGenerationParts([...updatedParts]);
    }
    
    const finalSuccessfulUrls = updatedParts
      .filter(p => p.status === 'success' && p.audioUrl)
      .map(p => p.audioUrl!);
    
    const finalHasFailures = updatedParts.some(p => p.status === 'error');

    if (!finalHasFailures && finalSuccessfulUrls.length > 0) {
      if (finalSuccessfulUrls.length > 1) {
        setIsCombining(true);
        try {
          const combined = await combineAudio(finalSuccessfulUrls);
          if (combined.media) {
            setCombinedAudioUrl(combined.media);
          } else {
            throw new Error("Failed to get combined audio from server.");
          }
        } catch (err: any) {
           setError(err.message || "An unexpected error occurred during audio combination.");
        }
      } else if (finalSuccessfulUrls.length === 1) {
        setCombinedAudioUrl(finalSuccessfulUrls[0]);
      }
    }

    setIsLoading(false);
    setIsCombining(false);
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
                <Label htmlFor="model-combobox" className="text-base">
                  TTS Model
                </Label>
                <Popover open={isModelPopoverOpen} onOpenChange={setIsModelPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="model-combobox"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isModelPopoverOpen}
                      className="w-full justify-between text-base rounded-lg bg-background"
                    >
                      <span className="truncate">{modelName || "Select or type a model..."}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command value={modelName} onValueChange={setModelName}>
                      <CommandInput placeholder="Search or type model name..." />
                      <CommandEmpty>No model found.</CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          {models.map((model) => (
                            <CommandItem
                              key={model.value}
                              value={model.value}
                              onSelect={(currentValue) => {
                                setModelName(currentValue);
                                setIsModelPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  modelName === model.value
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {model.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="text" className="text-base">
                  Your Text
                </Label>
                <Textarea
                  id="text"
                  placeholder="Enter text to convert. Use '#SCENE 1' for scenes or 'Speaker1: ...' for dialogues."
                  value={text}
                  onChange={(e) => {
                    const newText = e.target.value;
                    const oldFirstLine = text.split("\\n")[0].trim();
                    const newFirstLine = newText.split("\\n")[0].trim();

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

              <div className="space-y-2">
                <Label className="text-base">Split Options</Label>
                <RadioGroup
                  value={splitOption}
                  onValueChange={(value) => setSplitOption(value as 'length' | 'scene' | 'speaker')}
                  className="flex space-x-4 pt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="length" id="length" />
                    <Label htmlFor="length" className="font-normal">By Length</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="scene" id="scene" />
                    <Label htmlFor="scene" className="font-normal">By Scene (#SCENE XX)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="speaker" id="speaker" />
                    <Label htmlFor="speaker" className="font-normal">By Speaker Name</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base">
                    {speakers.length > 1 ? "Speakers (2 max)" : "Speaker"}
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSpeaker} className="rounded-lg" disabled={speakers.length >= 2}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Speaker
                  </Button>
                </div>
                <div className="space-y-3">
                  {speakers.map((speaker, index) => {
                    const selectedVoice = voices.find(
                      (v) => v.value === speaker.voiceName
                    );
                    return (
                      <div
                        key={speaker.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-secondary/50"
                      >
                        <div className="flex-1">
                          <Label
                            htmlFor={`speaker-name-${speaker.id}`}
                            className="sr-only"
                          >
                            Speaker Name
                          </Label>
                          <Input
                            id={`speaker-name-${speaker.id}`}
                            placeholder={
                              speakers.length > 1
                                ? `Speaker ${index + 1}`
                                : "Speaker Name"
                            }
                            value={speaker.name}
                            onChange={(e) =>
                              updateSpeaker(speaker.id, "name", e.target.value)
                            }
                            className="text-base rounded-lg"
                            aria-label="Speaker name"
                            disabled={speakers.length === 1}
                          />
                          {speakers.length === 1 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Name not used in single-speaker mode.
                            </p>
                          )}
                        </div>
                        <div className="flex-[2]">
                          <Popover
                            open={openPopoverId === speaker.id}
                            onOpenChange={(isOpen) =>
                              setOpenPopoverId(isOpen ? speaker.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between text-base rounded-lg bg-background"
                              >
                                <span className="truncate">
                                  {selectedVoice
                                    ? `${selectedVoice.label} (${selectedVoice.description})`
                                    : "Select voice..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                <CommandInput placeholder="Search voice..." />
                                <CommandEmpty>No voice found.</CommandEmpty>
                                <CommandList>
                                  <CommandGroup>
                                    {voices.map((voice) => (
                                      <CommandItem
                                        key={voice.value}
                                        value={voice.value}
                                        onSelect={(currentValue) => {
                                          updateSpeaker(
                                            speaker.id,
                                            "voiceName",
                                            currentValue
                                          );
                                          setOpenPopoverId(null);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            speaker.voiceName === voice.value
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        <span className="flex-grow">
                                          {voice.label}
                                        </span>
                                        {voice.description && (
                                          <span className="text-xs text-muted-foreground">
                                            {voice.description}
                                          </span>
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex-none">
                          {speakers.length > 1 ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSpeaker(speaker.id)}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove speaker</span>
                            </Button>
                          ) : (
                            <div className="w-10 h-10" />
                          ) /* Placeholder to keep alignment */}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                ) : hasFailures ? (
                  <>
                    <RefreshCcw className="mr-2 h-6 w-6" />
                    Retry Failed Parts
                  </>
                ) : (
                  "Generate Speech"
                )}
              </Button>
              {!isLoading && !isFormEmpty && (
                 <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClear}
                  className="w-full text-lg py-7 rounded-xl font-bold"
                  size="lg"
                >
                  <Trash2 className="mr-2 h-6 w-6"/>
                  Clear
                </Button>
              )}
              {(successfulParts.length > 0) && !isLoading && (
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
              {combinedAudioUrl && !hasFailures && (
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
              {generationParts.length > 0 && (
                <div className="mt-6 p-4 border rounded-xl bg-secondary">
                  <h3 className="font-semibold text-lg mb-3 text-secondary-foreground">
                    Audio Parts
                  </h3>
                  <div className="space-y-4">
                    {generationParts.map((part, index) => (
                      <div key={part.id}>
                        <Label className="text-sm text-muted-foreground flex items-center justify-between">
                           <span>Part {index + 1}</span>
                           {part.status === 'generating' && <span className="flex items-center text-xs"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generating...</span>}
                           {part.status === 'success' && <span className="flex items-center text-xs text-green-600"><CircleCheck className="mr-1 h-3 w-3" />Success</span>}
                           {part.status === 'error' && <span className="flex items-center text-xs text-red-600"><AlertCircle className="mr-1 h-3 w-3" />Failed</span>}
                        </Label>
                        {part.status === 'success' && part.audioUrl ? (
                            <audio controls src={part.audioUrl} className="w-full mt-1">
                              Your browser does not support the audio element.
                            </audio>
                        ) : (
                          <div className="w-full h-[40px] mt-1 bg-muted rounded-md flex items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                              {part.status === 'pending' && 'Waiting to generate...'}
                              {part.status === 'generating' && '...'}
                              {part.status === 'error' && 'Could not generate audio for this part.'}
                            </p>
                          </div>
                        )}
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
        <p>
          Created with passion by Julien Miquel{" "}
          <a
            href="mailto:julienmiquel@google.com"
            className="text-primary underline-offset-4 hover:underline"
          >
            &lt;julienmiquel@google.com&gt;
          </a>
        </p>
      </footer>
    </main>
  );
}
