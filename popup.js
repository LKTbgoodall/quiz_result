const apiKeyInput = document.getElementById("apiKey");
const modelSelect = document.getElementById("model");
const status = document.getElementById("status");
const answer = document.getElementById("answer");

chrome.action.setBadgeText({ text: "" });

chrome.storage.local.get(["apiKey", "model", "lastAnswer"]).then((data) => {
  apiKeyInput.value = data.apiKey || "";
  modelSelect.value = data.model || "gemini-flash-latest";
  if (data.lastAnswer) answer.textContent = data.lastAnswer;
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value.trim(),
  });
  status.textContent = "Enregistré";
  setTimeout(() => (status.textContent = ""), 1500);
});
