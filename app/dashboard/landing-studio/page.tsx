import { LandingStudio } from "@/components/landing-studio";

export default function LandingStudioPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-3xl font-black">Landing Studio</h1>
      <p className="mt-1 text-slate-500">Crea una landing page HTML completa en cualquier idioma usando el nombre y la descripción de tu producto.</p>
      <div className="mt-6"><LandingStudio /></div>
    </div>
  );
}
