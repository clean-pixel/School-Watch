export type AiCitation = { title: string; url: string };

export type OpenAIInputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" | "auto" };

export type OpenAIInputMessage = {
  role: "developer" | "system" | "user" | "assistant";
  content: string | OpenAIInputPart[];
};

type RunOptions = {
  input: string | OpenAIInputMessage[];
  useWebSearch?: boolean;
  maxOutputTokens?: number;
  jsonMode?: boolean;
};

type OpenAIErrorPayload = {
  message?: string;
  type?: string;
  code?: string | null;
  param?: string | null;
};

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

function safeProviderMessage(message?: string) {
  return (message ?? "")
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "[API-Schlüssel verborgen]")
    .replace(/Bearer\s+\S+/gi, "Bearer [verborgen]")
    .replace(/\s+/g, " ")
    .slice(0, 320);
}

export async function runOpenAIResponse({ input, useWebSearch = false, maxOutputTokens = 1800, jsonMode = false }: RunOptions) {
  const apiKey = (process.env.OPENAI_API_KEY ?? "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^(['"])(.*)\1$/, "$2")
    .replace(/\s+/g, "");

  if (!apiKey) {
    throw new AiConfigurationError("Die KI ist noch nicht verbunden. Hinterlege OPENAI_API_KEY in Vercel.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";
  const tools = useWebSearch ? [{ type: "web_search", search_context_size: "low" }] : undefined;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model,
      input,
      ...(tools ? { tools, tool_choice: "auto" } : {}),
      ...(jsonMode ? { text: { format: { type: "json_object" } } } : {}),
      max_output_tokens: maxOutputTokens,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({})) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; title?: string; url?: string }> }> }>;
    error?: OpenAIErrorPayload;
  };

  if (!response.ok) {
    const providerError = payload.error;
    const providerCode = typeof providerError?.code === "string" ? providerError.code : "";
    const providerType = typeof providerError?.type === "string" ? providerError.type : "";
    const providerMessage = safeProviderMessage(providerError?.message);
    const requestId = response.headers.get("x-request-id");
    const keyFormat = apiKey.startsWith("sk-proj-") ? "project-key" : apiKey.startsWith("sk-") ? "sk-key" : "unknown-format";

    console.error("[SchulWatch OpenAI] Responses API error", {
      status: response.status,
      code: providerCode || null,
      type: providerType || null,
      requestId,
      model,
      keyFormat,
      message: providerMessage || null,
    });

    const codeHint = providerCode ? "Code: " + providerCode + ". " : "";
    if (response.status === 401) {
      throw new AiConfigurationError(
        "OpenAI hat die Authentifizierung abgelehnt. " + codeHint +
        (providerMessage || "Prüfe, ob OPENAI_API_KEY ein aktiver API-Schlüssel aus dem richtigen OpenAI-Projekt ist.")
      );
    }
    if (response.status === 403) {
      throw new AiConfigurationError(
        "OpenAI hat den Zugriff verweigert. " + codeHint +
        (providerMessage || "Prüfe die Berechtigungen des API-Projekts.")
      );
    }
    if (response.status === 429) {
      if (providerCode === "insufficient_quota") {
        throw new Error("Das API-Nutzungskontingent ist aufgebraucht. Prüfe das Abrechnungskonto des OpenAI-API-Projekts.");
      }
      throw new Error("OpenAI begrenzt die Anfrage gerade. " + codeHint +
        (providerMessage || "Bitte versuche es gleich erneut."));
    }
    throw new Error(
      "OpenAI-Anfrage fehlgeschlagen (HTTP " + response.status + "). " + codeHint +
      (providerMessage || "Die genaue Ursache steht in den Vercel-Funktionslogs.")
    );
  }

  const content = (payload.output ?? []).flatMap((item) => item.content ?? []);
  const text = payload.output_text || content
    .filter((part) => part.type === "output_text" || part.text)
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  const citations: AiCitation[] = [];
  for (const part of content) {
    for (const annotation of part.annotations ?? []) {
      if (annotation.type === "url_citation" && annotation.url) {
        citations.push({ title: annotation.title || annotation.url, url: annotation.url });
      }
    }
  }

  if (!text) throw new Error("Die KI hat keine Antwort geliefert. Bitte versuche es erneut.");
  return {
    text,
    citations: citations.filter((citation, index, list) => list.findIndex((item) => item.url === citation.url) === index).slice(0, 8),
  };
}
