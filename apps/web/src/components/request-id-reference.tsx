import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "./ui";

export function RequestIdReference({ requestId }: Readonly<{ requestId?: string }>) {
  const [copied, setCopied] = useState(false);

  if (!requestId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-600">
      <span>Referencia:</span>
      <code className="break-all rounded bg-white/70 px-2 py-1 font-mono text-ink-800">
        {requestId}
      </code>
      <Button
        aria-label="Copiar ID de solicitud"
        className="h-8 px-2.5 text-xs"
        size="sm"
        variant="outline"
        onClick={() => void copy()}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copiado" : "Copiar ID"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? "ID de solicitud copiado" : ""}
      </span>
    </div>
  );
}
