"use client";

import { useMutation } from "convex/react";
import { ChevronDown, Trash2, Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { LanguageBadge } from "@/components/language-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatRecordDate } from "@/lib/month";
import { getUserErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { WordDocument } from "@/lib/types";

type WordRowProps = {
  word: WordDocument;
  speechAvailable: boolean;
  onSpeak: (text: string, language: WordDocument["language"]) => void;
};

const genderLabel = {
  masculine: "阳性",
  feminine: "阴性",
  neutral: "中性",
} as const;

export function WordRow({ word, speechAvailable, onSpeak }: WordRowProps) {
  const deleteWord = useMutation(api.words.deleteWord);
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const detailsId = `word-details-${word._id}`;

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteWord({ id: word._id });
      setDialogOpen(false);
      toast.success(`已删除 ${word.word}`);
    } catch (error) {
      toast.error(getUserErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="border-b border-border content-auto">
      <div className="grid grid-cols-[1fr_auto] gap-x-3 py-5 sm:grid-cols-[minmax(10rem,1.1fr)_5rem_minmax(8rem,0.9fr)_minmax(12rem,1.5fr)_auto] sm:items-center sm:gap-x-5 sm:py-6">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-[1.65rem] leading-none tracking-[-0.025em]">{word.word}</h3>
          <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground sm:hidden">{word.phonetic}</p>
        </div>
        <LanguageBadge language={word.language} className="hidden justify-self-start sm:inline-flex" />
        <p className="hidden truncate font-mono text-xs text-muted-foreground sm:block">{word.phonetic}</p>
        <p className="col-span-2 mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground sm:col-span-1 sm:mt-0 sm:line-clamp-1">
          {word.definitions[0]?.meaningZh}
          {word.definitions.length > 1 ? <span className="ml-1 font-mono text-[10px]">+{word.definitions.length - 1}</span> : null}
        </p>
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-0 sm:col-start-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onSpeak(word.word, word.language)}
            disabled={!speechAvailable}
            aria-label={`朗读 ${word.word}`}
            title={speechAvailable ? "播放发音" : "此浏览器不支持语音朗读"}
          >
            <Volume2 className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={expanded ? "收起词条详情" : "展开词条详情"}
          >
            <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div id={detailsId} className={cn("grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} aria-hidden={!expanded}>
        <div className="overflow-hidden">
          <div className="grid gap-8 pb-8 pl-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:pl-[calc(1.1fr)]">
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Definitions</p>
              <ol className="space-y-3">
                {word.definitions.map((definition, index) => (
                  <li key={`${definition.partOfSpeech}-${index}`} className="grid grid-cols-[1.25rem_1fr] gap-2 text-sm leading-6">
                    <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <span><i className="mr-2 text-muted-foreground">{definition.partOfSpeech}</i>{definition.meaningZh}</span>
                  </li>
                ))}
              </ol>

              {word.grammar ? (
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-l border-border pl-4 text-xs text-muted-foreground">
                  {word.grammar.gender ? <span>词性 · {genderLabel[word.grammar.gender]}</span> : null}
                  {word.grammar.infinitive ? <span>原形 · <b className="font-serif font-normal text-foreground">{word.grammar.infinitive}</b></span> : null}
                  {word.grammar.noteZh ? <span className="basis-full">{word.grammar.noteZh}</span> : null}
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">In context</p>
              <div className="space-y-5">
                {word.examples.map((example, index) => (
                  <blockquote key={`${example.target}-${index}`} className="border-l border-border pl-4">
                    <p className="font-serif text-lg leading-6">{example.target}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{example.translationZh}</p>
                  </blockquote>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 text-[10px] text-muted-foreground sm:col-span-2">
              <p className="font-mono tracking-[0.08em]">收录 {formatRecordDate(word.createdAt)}{word.updatedAt > word.createdAt + 1000 ? ` · 更新 ${formatRecordDate(word.updatedAt)}` : ""}</p>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" aria-hidden="true" />删除
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>删除“{word.word}”？</DialogTitle>
                  <DialogDescription>词义、例句和已经积累的复习进度都会被永久删除。此操作无法撤销。</DialogDescription>
                  <div className="mt-7 flex justify-end gap-3">
                    <DialogClose asChild><Button type="button" variant="ghost" disabled={deleting}>保留词条</Button></DialogClose>
                    <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? "正在删除…" : "确认删除"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
