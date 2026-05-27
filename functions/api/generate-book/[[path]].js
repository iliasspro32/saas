import generateWorker from "../../../bookforge-ai/workers/generate-book.js";

export async function onRequest({ request, env }) {
  return generateWorker.fetch(request, env);
}
