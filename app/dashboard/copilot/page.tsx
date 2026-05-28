import { Bot, Lightbulb, MessageSquareText, Send, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const messages = [
  { role: "Copilot", text: "Your Meta broad campaign has stable ROAS at 3.8x. I would increase budget by 15% and keep creative rotation unchanged." },
  { role: "You", text: "Which creatives should I duplicate into TikTok?" },
  { role: "Copilot", text: "Duplicate the Spanish demo testimonial and the before/after angle. Both beat account CPC by more than 30%." }
];

const insights = [
  { icon: TrendingUp, title: "Scale", text: "3 campaigns are above target ROAS for 6 consecutive hours." },
  { icon: TrendingDown, title: "Protect", text: "Snap retargeting is burning budget after midnight in Europe/Madrid." },
  { icon: Lightbulb, title: "Create", text: "New UGC hook opportunity: compare pain point vs result in first 2 seconds." }
];

export default function CopilotPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <h1 className="text-3xl font-black">AI Copilot</h1>
        <p className="mt-1 text-slate-500">A proactive media buyer that watches account performance and suggests actions.</p>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card className="min-h-[680px]">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950"><Bot className="h-5 w-5" /></div>
            <div>
              <h2 className="font-black">Performance chat</h2>
              <p className="text-sm text-slate-500">Ask about spend, ROAS, creatives, rules or launch plans.</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {messages.map((message) => (
              <div key={message.text} className={`max-w-2xl rounded-lg p-4 text-sm leading-7 ${message.role === "You" ? "ml-auto bg-brand-600 text-white" : "bg-slate-50 dark:bg-slate-950"}`}>
                <b>{message.role}</b>
                <p className="mt-1">{message.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex gap-3 rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950">
            <input className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" placeholder="Ask what to pause, scale, duplicate or test next..." />
            <Button className="h-10 px-4"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
        <div className="space-y-6">
          {insights.map((item) => (
            <Card key={item.title}>
              <item.icon className="h-5 w-5 text-brand-600" />
              <h3 className="mt-4 text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
            </Card>
          ))}
          <Card className="bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <MessageSquareText className="h-5 w-5 text-mint" />
            <h3 className="mt-4 text-lg font-black">Hourly account scan</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300 dark:text-slate-600">Next scan checks spend spikes, learning phase resets, fatigued creatives and missing UTMs.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
