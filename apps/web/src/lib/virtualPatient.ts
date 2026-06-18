import type {
  CreateVPSessionInput,
  VirtualPatientSessionView,
  VPDiagnosisAttempt,
  VPExamResult,
  VPSessionSummary,
  VPStreamEvent,
} from "@med/shared";
import { api, getToken } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function listSessions() {
  return api<VPSessionSummary[]>("/virtual-patient/sessions");
}

export function createSession(input: CreateVPSessionInput) {
  return api<VirtualPatientSessionView>("/virtual-patient/sessions", {
    method: "POST",
    body: input,
  });
}

export function getSession(id: string) {
  return api<VirtualPatientSessionView>(`/virtual-patient/sessions/${id}`);
}

export function orderExam(id: string, name: string) {
  return api<{ exam: VPExamResult; session: VirtualPatientSessionView }>(
    `/virtual-patient/sessions/${id}/exam`,
    { method: "POST", body: { name } },
  );
}

export function submitDiagnosis(id: string, value: string) {
  return api<{ diagnosis: VPDiagnosisAttempt; session: VirtualPatientSessionView }>(
    `/virtual-patient/sessions/${id}/diagnosis`,
    { method: "POST", body: { value } },
  );
}

export function finalizeSession(id: string) {
  return api<{ debrief: VirtualPatientSessionView["debrief"]; session: VirtualPatientSessionView }>(
    `/virtual-patient/sessions/${id}/finalize`,
    { method: "POST" },
  );
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (payload: Extract<VPStreamEvent, { type: "done" }>) => void;
  onError: (message: string) => void;
}

/**
 * POST to a streaming endpoint and consume the Server-Sent-Events response via
 * the fetch ReadableStream (EventSource can't POST). Parses `data:`/`event:`
 * frames separated by a blank line.
 */
async function streamAction(path: string, body: unknown, handlers: StreamHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken() ?? ""}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    handlers.onError((err as Error).message);
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError(`Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const handleFrame = (frame: string) => {
    let event = "message";
    let data = "";
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    let parsed: VPStreamEvent;
    try {
      parsed = JSON.parse(data) as VPStreamEvent;
    } catch {
      return;
    }
    if (event === "done" || parsed.type === "done") {
      handlers.onDone(parsed as Extract<VPStreamEvent, { type: "done" }>);
    } else if (event === "error" || parsed.type === "error") {
      handlers.onError((parsed as Extract<VPStreamEvent, { type: "error" }>).message);
    } else if (parsed.type === "delta") {
      handlers.onDelta(parsed.text);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      handleFrame(frame);
    }
  }
  if (buf.trim()) handleFrame(buf);
}

export function streamMessage(id: string, content: string, handlers: StreamHandlers) {
  return streamAction(`/virtual-patient/sessions/${id}/message`, { content }, handlers);
}

export function streamTreatment(
  id: string,
  body: { name: string; dosage?: string },
  handlers: StreamHandlers,
) {
  return streamAction(`/virtual-patient/sessions/${id}/treatment`, body, handlers);
}
