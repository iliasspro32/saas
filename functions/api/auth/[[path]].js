import authWorker from "../../../bookforge-ai/workers/auth.js";

export async function onRequest({ request, env }) {
  return authWorker.fetch(request, env);
}
