import fs from "node:fs";
import path from "node:path";
import { getAuth } from "firebase-admin/auth";
import { getApps, initializeApp } from "firebase-admin/app";

interface AiAnnotation {
  text: string;
  confidence: number;
}

interface AiDetectionResult {
  status: number;
  body: { error: string } | {
    aiScore: number;
    isDetected: boolean;
    annotations: AiAnnotation[];
  };
}

function getFirebaseAuth() {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
      projectId = firebaseConfig.projectId;
    } catch (err) {
      throw new Error(`Could not read firebase-applet-config.json to get projectId: ${err}`);
    }
  }
  if (!projectId) {
    throw new Error("Firebase projectId is not set. Set FIREBASE_PROJECT_ID or add projectId to firebase-applet-config.json.");
  }
  const app = getApps()[0] || initializeApp({ projectId });
  return getAuth(app);
}

function getProviderErrorMessage(responseBody: string): string | undefined {
  try {
    const payload: unknown = JSON.parse(responseBody);
    if (!payload || typeof payload !== "object") {
      return undefined;
    }

    const messages: string[] = [];
    const collectMessage = (value: unknown): void => {
      if (typeof value === "string") {
        messages.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            collectMessage(record.msg ?? record.message ?? record.detail);
          }
        });
        return;
      }
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        collectMessage(record.detail);
        collectMessage(record.message);
        collectMessage(record.error);
      }
    };
    collectMessage(payload);

    const detail = messages
      .map(message => message.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("; ");
    return detail ? detail.slice(0, 240) : undefined;
  } catch {
    return undefined;
  }
}

export async function analyzeTextWithAiOrNot(
  authorization: string | undefined,
  text: unknown
): Promise<AiDetectionResult> {
  const tokenMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return { status: 401, body: { error: "Sign in is required to run AI detection." } };
  }

  try {
    await getFirebaseAuth().verifyIdToken(tokenMatch[1]);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    // Firebase Admin needs service account credentials to verify tokens outside GCP.
    // Without GOOGLE_APPLICATION_CREDENTIALS set, it throws a credential error.
    if (
      msg.includes('credential') ||
      msg.includes('Could not load the default credentials') ||
      msg.includes('UNAUTHENTICATED') ||
      msg.includes('projectId is not set')
    ) {
      console.error('Firebase Admin credential error — set GOOGLE_APPLICATION_CREDENTIALS or run on GCP:', msg);
      return {
        status: 503,
        body: { error: 'AI detection is not available: the server is missing Firebase Admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS to a service account key file.' },
      };
    }
    return { status: 401, body: { error: 'Your sign-in session is invalid or expired. Sign in again.' } };
  }

  const apiKey = process.env.AIORNOT_API_KEY;
  if (!apiKey) {
    return { status: 503, body: { error: "AI detection is not configured on the server." } };
  }

  if (typeof text !== "string") {
    return { status: 400, body: { error: "Missing text to analyze." } };
  }
  if (text.length < 250) {
    return { status: 422, body: { error: "AI or Not requires at least 250 characters for text analysis." } };
  }
  if (text.trim().split(/\s+/).filter(Boolean).length < 64) {
    return { status: 422, body: { error: "AI or Not requires approximately 64 words for text analysis." } };
  }
  if (text.length > 500_000) {
    return { status: 413, body: { error: "Text exceeds AI or Not's 500,000-character analysis limit." } };
  }

  try {
    const endpoint = new URL("https://prod.ai-or-not.com/v2/text/sync");
    endpoint.searchParams.set("include_annotations", "true");
    const form = new FormData();
    form.set("text", text);
    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstreamResponse.ok) {
      const providerError = getProviderErrorMessage(await upstreamResponse.text());
      const requestId = upstreamResponse.headers.get("x-request-id")
        || upstreamResponse.headers.get("request-id");
      console.error(
        `AI or Not request failed with status ${upstreamResponse.status}.`,
        { providerError, requestId }
      );
      const diagnostic = providerError
        ? ` Provider detail: ${providerError}`
        : upstreamResponse.status === 400
          ? " Provider gave no additional error detail. Confirm that the API key is accepted for production text analysis; contact AI or Not support with the request ID if this continues."
          : "";
      const requestIdDetail = requestId ? ` Provider request ID: ${requestId}.` : "";
      return {
        status: 502,
        body: {
          error: `AI detection provider returned an error (HTTP ${upstreamResponse.status}).${diagnostic}${requestIdDetail} No score was generated.`,
        },
      };
    }

    const payload = await upstreamResponse.json();
    const aiText = payload?.report?.ai_text;
    if (
      typeof aiText?.confidence !== "number" ||
      !Number.isFinite(aiText.confidence) ||
      aiText.confidence < 0 ||
      aiText.confidence > 1 ||
      typeof aiText.is_detected !== "boolean"
    ) {
      console.error("AI or Not returned an invalid text analysis response.");
      return {
        status: 502,
        body: { error: "AI detection provider returned an invalid response. No score was generated." },
      };
    }

    const annotations: AiAnnotation[] = Array.isArray(aiText.annotations)
      ? aiText.annotations
          .filter(
            (annotation: unknown) =>
              Array.isArray(annotation) &&
              typeof annotation[0] === "string" &&
              typeof annotation[1] === "number" &&
              Number.isFinite(annotation[1]) &&
              annotation[1] >= 0 &&
              annotation[1] <= 1
          )
          .map((annotation: [string, number]) => ({
            text: annotation[0],
            confidence: annotation[1],
          }))
      : [];

    return {
      status: 200,
      body: {
        aiScore: Math.round(aiText.confidence * 100),
        isDetected: aiText.is_detected,
        annotations,
      },
    };
  } catch (error) {
    console.error("AI or Not request failed:", error);
    return {
      status: 502,
      body: { error: "Could not complete AI detection with the provider. No score was generated." },
    };
  }
}
