import authWorker from "../../../workers/auth.js";

export async function onRequest({ request, env }) {
  return authWorker.fetch(request, env);
}
