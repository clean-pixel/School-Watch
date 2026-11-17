export type AiCitation = { title: string; url: string };

type RunOptions = {
  input: string;
  useWebSearch?: boolean;
  maxOutputTokens?: number;
};

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export async function runOpenAIResponse({ input, useWebSearch = false, maxOutputTokens = 1800 }: RunOptions) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiConfigurationError("Die KI ist noch nicht verbunden. Hinterlege OPENAI_API_KEY in deiner lokalen .env.local und später auch in Vercel.");
  }

  const tools = useWebSearch ? [{ type: "web_search", search_context_size: "low" }] : undefined;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-6-luna",
      input,
      ...(tools ? { tools, tool_choice: "auto" } : {}),
      max_output_tokens: maxOutputTokens,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({})) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; title?: string; url?: string }> }> }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message || `OpenAI-Anfrage fehlgeschlagen (HTTP ${response.status}).`;
    throw new Error(message);
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
