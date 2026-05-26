"use client";

import { ErrorState } from "@/components/ui/states";

export default function Error({ error }: { error: Error }) {
  return <main className="p-6"><ErrorState text={error.message} /></main>;
}
