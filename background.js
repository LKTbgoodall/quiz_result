const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-flash-latest";

const SYSTEM_PROMPT =
  "Tu reçois une capture d'écran contenant une question de quiz. " +
  "Réponds UNIQUEMENT avec la bonne réponse, le plus court possible : " +
  "la lettre seule pour un QCM (ex : « B »), sinon un nombre ou deux à trois mots maximum. " +
  "Aucune phrase, aucune explication, aucune ponctuation inutile. " +
  "Si plusieurs questions sont visibles, une réponse par ligne au format « 1. B ». " +
  "Si aucune question n'est lisible, réponds « ? ».";

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-and-ask") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    // captureVisibleTab ne produit aucun effet visible (pas de flash, pas de son).
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await showOverlay(tab.id, "…", true);

    const answer = await askGemini(dataUrl.split(",")[1]);
    await chrome.storage.local.set({ lastAnswer: answer, lastAt: Date.now() });
    await showOverlay(tab.id, answer, false);
  } catch (err) {
    const message = "Erreur : " + (err?.message || String(err));
    await chrome.storage.local.set({ lastAnswer: message, lastAt: Date.now() });
    await showOverlay(tab.id, message, false);
  }
});

// Erreurs temporaires (surcharge, quota par minute) : on réessaie puis on passe au modèle suivant.
const RETRYABLE_STATUS = [429, 500, 503];
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const ATTEMPTS_PER_MODEL = 2;

async function askGemini(base64Png) {
  const { apiKey, model } = await chrome.storage.local.get(["apiKey", "model"]);
  if (!apiKey) throw new Error("clé API manquante (clique sur l'icône de l'extension).");

  const models = [...new Set([model || DEFAULT_MODEL, ...FALLBACK_MODELS])];
  let lastError;
  for (const m of models) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      try {
        return await callGemini(m, apiKey, base64Png);
      } catch (err) {
        lastError = err;
        if (!err.retryable) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    // Modèle introuvable ou indisponible : on tente le suivant ; autre erreur (clé invalide…) : on arrête.
    if (!lastError.retryable && lastError.status !== 404) throw lastError;
  }
  throw lastError;
}

async function callGemini(model, apiKey, base64Png) {
  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: "image/png", data: base64Png } },
            { text: "Quelle est la réponse ?" },
          ],
        },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error?.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.retryable = RETRYABLE_STATUS.includes(response.status);
    throw err;
  }
  if (data.promptFeedback?.blockReason) {
    throw new Error(`requête bloquée par Gemini (${data.promptFeedback.blockReason}).`);
  }

  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("\n")
    .trim();
  if (!text && candidate?.finishReason) {
    throw new Error(`pas de réponse (${candidate.finishReason}).`);
  }
  return text || "(réponse vide)";
}

async function showOverlay(tabId, text, loading) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: renderOverlay,
      args: [text, loading],
    });
  } catch {
    // Pages où l'injection est interdite (chrome://, Web Store…) : la réponse reste dans le popup.
    await chrome.action.setBadgeText({ text: loading ? "…" : "✓" });
  }
}

// Injectée dans la page : petite étiquette discrète en bas à droite, fermée par Échap ou clic.
function renderOverlay(text, loading) {
  const HOST_ID = "__quiz_helper_overlay__";
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.attachShadow({ mode: "open" });
    document.documentElement.appendChild(host);

    const close = () => {
      host.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey, true);
    host.addEventListener("click", close);
  }

  // Texte sans fond qui s'inverse selon la page (sombre sur fond clair, clair sur fond sombre),
  // très transparent au repos, lisible au survol de la souris.
  host.shadowRoot.innerHTML = `
    <style>
      .box {
        all: initial;
        position: fixed; right: 10px; bottom: 8px; z-index: 2147483647;
        max-width: 220px; max-height: 30vh; overflow: auto;
        color: #fff; mix-blend-mode: difference;
        font: 500 11px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
        white-space: pre-wrap; cursor: pointer; user-select: none;
        opacity: 0.3; transition: opacity 0.15s;
      }
      .box:hover { opacity: 1; }
      .dot {
        display: block; width: 5px; height: 5px; margin: 2px 0;
        border-radius: 50%; background: currentColor;
        animation: pulse 1s ease-in-out infinite;
      }
      @keyframes pulse { 50% { opacity: 0.2; } }
    </style>
    <div class="box"></div>`;
  const box = host.shadowRoot.querySelector(".box");
  if (loading) box.innerHTML = '<span class="dot"></span>';
  else box.textContent = text;
}
