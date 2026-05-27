import generateWorker from "../../../workers/generate-book.js";

export async function onRequest({ request, env }) {
  return generateWorker.fetch(request, env);
}
