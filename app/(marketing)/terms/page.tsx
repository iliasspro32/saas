export default function TermsPage() {
  return <Legal title="Terms of Service" body="IvoMarket AI is provided as a subscription software product. Users are responsible for reviewing generated content, maintaining lawful usage, and complying with platform advertising rules. Abuse, credential sharing, automated scraping, or attempts to bypass credit limits may result in account restriction." />;
}

function Legal({ title, body }: { title: string; body: string }) {
  return <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><h1 className="text-4xl font-black">{title}</h1><p className="mt-6 leading-8 text-slate-600 dark:text-slate-300">{body}</p></main>;
}
