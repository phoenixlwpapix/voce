"use client";

import { useConvex } from "convex/react";
import type { PaginationResult } from "convex/server";
import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { languageNames } from "@/lib/constants";
import { getUserErrorMessage } from "@/lib/errors";
import { createVocabularyCsv, vocabularyExportFilename } from "@/lib/word-export";
import type { Language, WordDocument } from "@/lib/types";

type ExportScope = "current" | "all";

export function VocabularyExport({ language, menuItem = false }: { language: Language; menuItem?: boolean }) {
  const convex = useConvex();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>("current");
  const [exporting, setExporting] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (exporting) return;
    setOpen(nextOpen);
    if (nextOpen) setScope("current");
  }

  async function exportWords() {
    if (exporting) return;
    setExporting(true);
    try {
      const words: WordDocument[] = [];
      let cursor: string | null = null;
      let isDone = false;

      while (!isDone) {
        const paginationOpts: { cursor: string | null; numItems: number } = { cursor, numItems: 200 };
        const result: PaginationResult<WordDocument> = scope === "current"
          ? await convex.query(api.words.getWordsForExport, { language, paginationOpts })
          : await convex.query(api.words.getWordsForExport, { paginationOpts });
        words.push(...result.page);
        cursor = result.continueCursor;
        isDone = result.isDone;
      }

      if (words.length === 0) {
        toast.info(scope === "current" ? `没有可导出的${languageNames[language]}词汇。` : "暂无已保存的生词可导出。");
        return;
      }

      const csv = createVocabularyCsv(words);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = vocabularyExportFilename(scope === "current" ? language : "all");
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setOpen(false);
      toast.success(`成功导出 ${words.length} 个词汇。`, {
        description: scope === "current" ? `${languageNames[language]}词汇 · CSV` : "所有语种词汇 · CSV",
      });
    } catch (error) {
      toast.error(getUserErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant={menuItem ? "ghost" : "outline"} size={menuItem ? "default" : "sm"} className={menuItem ? "w-full justify-start px-3 text-sm" : undefined}>
          <Download className="size-4" aria-hidden="true" />
          导出词汇
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>导出词汇</DialogTitle>
        <DialogDescription>
          下载包含释义、语法备注、例句和添加日期的 UTF-8 CSV 文件。
        </DialogDescription>

        <fieldset className="mt-7 space-y-2" disabled={exporting}>
          <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">导出范围</legend>
          <label className="flex cursor-pointer items-start gap-3 border border-border p-4 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-secondary/60">
            <input
              type="radio"
              name="export-scope"
              value="current"
              checked={scope === "current"}
              onChange={() => setScope("current")}
              className="mt-1 accent-foreground"
            />
            <span>
              <span className="block text-sm font-medium">当前语种</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">已保存的所有{languageNames[language]}词汇 ({language})</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 border border-border p-4 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-secondary/60">
            <input
              type="radio"
              name="export-scope"
              value="all"
              checked={scope === "all"}
              onChange={() => setScope("all")}
              className="mt-1 accent-foreground"
            />
            <span>
              <span className="block text-sm font-medium">所有语种</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">英语、法语、西班牙语与日语整合至单一文件</span>
            </span>
          </label>
        </fieldset>

        <div className="mt-7 flex justify-end gap-3">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={exporting}>取消</Button>
          </DialogClose>
          <Button type="button" onClick={() => void exportWords()} disabled={exporting}>
            {exporting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            {exporting ? "正在生成…" : "下载 CSV"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
