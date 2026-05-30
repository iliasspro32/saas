import toolsWorker from "../../../bookforge-ai/workers/tools.js";

export async function onRequest({ request, env }) {
  return toolsWorker.fetch(request, env);
}
