"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInvestigateTraffic } from "@/lib/query/useTrafficIntelligence";
import { InvestigationResultCard } from "./InvestigationResultCard";

const SUGGESTED_QUESTIONS = [
  "Why did my visitors decrease compared to last week?",
  "Why did traffic suddenly increase yesterday?",
  "What should I change to increase website traffic next week?",
];

const inputClass = "h-9 w-full rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-accent";

export function TrafficAiQueryPanel() {
  const [question, setQuestion] = useState("");
  const investigate = useInvestigateTraffic();

  const ask = (text: string) => {
    if (!text.trim()) return;
    setQuestion(text);
    investigate.mutate({ question: text });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask the AI Investigation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <input
            className={inputClass}
            placeholder="e.g. Why was my website traffic so low on 15/08/2026?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button type="submit" disabled={investigate.isPending}>
            <Search className="h-4 w-4" />
            Ask
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover"
            >
              {q}
            </button>
          ))}
        </div>

        {investigate.isPending && <p className="text-xs text-text-muted">Investigating…</p>}
        {investigate.isError && <p className="text-xs text-critical">Couldn&apos;t complete the investigation. Try again.</p>}
        {investigate.data && <InvestigationResultCard result={investigate.data} />}
      </CardContent>
    </Card>
  );
}
