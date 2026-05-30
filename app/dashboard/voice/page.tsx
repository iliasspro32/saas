import { SocialVideoDownloader } from "@/components/social-video-downloader";
import VoiceStudio from "@/components/voice-studio/VoiceStudio";

export default function VoicePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SocialVideoDownloader />
      <VoiceStudio />
    </div>
  );
}
