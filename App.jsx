import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, FlaskConical, Trophy, Superscript, Subscript } from "lucide-react";

/**
 * Molecuulformules oefenen
 *
 * PAS HIER JE EIGEN LIJST AAN:
 * - prompt: wat de leerling ziet
 * - answers: meerdere goede antwoorden mogelijk
 */
const QUESTION_BANK = [
  { id: 1, prompt: "water", answers: ["H2O", "H₂O"] },
  { id: 2, prompt: "koolstofdioxide", answers: ["CO2", "CO₂"] },
  { id: 3, prompt: "zuurstof", answers: ["O2", "O₂"] },
  { id: 4, prompt: "stikstof", answers: ["N2", "N₂"] },
  { id: 5, prompt: "ammoniak", answers: ["NH3", "NH₃"] },
  { id: 6, prompt: "methaan", answers: ["CH4", "CH₄"] },
];

const SUBSCRIPT_DIGITS = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

const SUPERSCRIPT_DIGITS = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
};

const SCRIPT_CLASS_BY_MODE = {
  sub: "formula-sub",
  sup: "formula-sup",
};

const ALLOWED_SCRIPT_CHARS = new Set([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "+", "-", "−"
]);

const MANUAL_TEST_CASES = [
  "Typ H, klik Subscript, typ 2, klik Subscript opnieuw, typ O → de O is meteen normale tekst.",
  "Klik Superscript en typ 2+ → de tekens verschijnen direct klein en hoog in het invoerveld.",
  "Klik nog een keer op Subscript of Superscript om terug te gaan naar normale tekst; het eerstvolgende teken is meteen normaal.",
  "In subscript- en superscriptstand zijn alleen letters, cijfers, + en − toegestaan.",
  "Er is maar één niveau: je krijgt nooit subscript in subscript of superscript in superscript.",
  "De badge en de gekleurde rand van het invoerveld laten zien in welke stand je typt.",
  "Antwoordcontrole accepteert nog steeds meerdere goede antwoorden uit QUESTION_BANK.",
  "Na afloop verschijnt een knop om eenmalig alleen de fout beantwoorde vragen opnieuw te oefenen.",
];

function normalizeFormula(input) {
  if (!input) return "";

  let html = String(input)
    .replace(/<div><br><\/div>/gi, "")
    .replace(/<div>/gi, "")
    .replace(/<\/div>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u200B/g, "");

  html = html
    .replace(/<span[^>]*class=["'][^"']*formula-sub[^"']*["'][^>]*>(.*?)<\/span>/gi, (_, content) => content)
    .replace(/<span[^>]*class=["'][^"']*formula-sup[^"']*["'][^>]*>(.*?)<\/span>/gi, (_, content) => content)
    .replace(/<sub[^>]*>(.*?)<\/sub>/gi, (_, content) => content)
    .replace(/<sup[^>]*>(.*?)<\/sup>/gi, (_, content) => content);

  return html
    .replace(/<[^>]+>/g, "")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (char) => SUBSCRIPT_DIGITS[char] || char)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, (char) => SUPERSCRIPT_DIGITS[char] || char)
    .replace(/−/g, "-")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function scoreAnswer(rawAnswer, validAnswers) {
  const normalized = normalizeFormula(rawAnswer);
  return validAnswers.some((answer) => normalizeFormula(answer) === normalized);
}

function insertNodeAtCursor(node, options = {}) {
  const { ensureTextCursorAfter = false } = options;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);

  const newRange = document.createRange();
  const insertedNode = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? range.endContainer : node;

  if (ensureTextCursorAfter) {
    const anchorParent = insertedNode.parentNode || range.endContainer.parentNode;
    if (anchorParent) {
      const textNode = document.createTextNode("\u200B");
      anchorParent.insertBefore(textNode, insertedNode.nextSibling || null);
      newRange.setStart(textNode, 1);
    } else {
      newRange.setStart(range.endContainer, range.endOffset);
    }
  } else if (node.nodeType === Node.TEXT_NODE) {
    newRange.setStart(node, node.textContent?.length || 0);
  } else {
    newRange.setStart(range.endContainer, range.endOffset);
  }

  newRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(newRange);
  return true;
}

function placeCaretAtEnd(element) {
  if (!element) return;
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function selectionIsInside(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const anchorNode = selection.anchorNode;
  return !!anchorNode && element.contains(anchorNode);
}

function findActiveScriptSpan(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  let node = selection.anchorNode;
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      if (el.classList?.contains("formula-sub") || el.classList?.contains("formula-sup")) {
        return el;
      }
    }
    node = node.parentNode;
  }

  return null;
}

function placeCaretAfterNode(node) {
  if (!node || !node.parentNode) return;
  const range = document.createRange();
  const selection = window.getSelection();

  let nextNode = node.nextSibling;
  if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE) {
    nextNode = document.createTextNode("");
    node.parentNode.insertBefore(nextNode, node.nextSibling);
  }

  range.setStart(nextNode, 0);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function FormulaInput({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const [scriptMode, setScriptMode] = useState(null);
  const scriptModeRef = useRef(null);

  useEffect(() => {
    scriptModeRef.current = scriptMode;
  }, [scriptMode]);

  useEffect(() => {
    if (!ref.current) return;
    if (value === "" && ref.current.innerHTML !== "") {
      ref.current.innerHTML = "";
      setScriptMode(null);
      scriptModeRef.current = null;
    }
  }, [value]);

  const syncValue = () => {
    onChange((ref.current?.innerHTML || "").replace(/​/g, ""));
  };

  const focusEditor = () => {
    if (!ref.current) return;
    ref.current.focus();
    if (!selectionIsInside(ref.current)) {
      placeCaretAtEnd(ref.current);
    }
  };

  const normalizeTypedChar = (char) => (char === "-" ? "−" : char);
  const isAllowedScriptChar = (char) => ALLOWED_SCRIPT_CHARS.has(char);

  const forcePlainCaret = () => {
    if (!ref.current) return;
    const activeSpan = findActiveScriptSpan(ref.current);
    if (activeSpan) {
      placeCaretAfterNode(activeSpan);
    }
  };

  const insertPlainText = (text) => {
    focusEditor();
    forcePlainCaret();
    insertNodeAtCursor(document.createTextNode(text));
    syncValue();
  };

  const insertScriptText = (text, mode) => {
    focusEditor();
    const span = document.createElement("span");
    span.className = SCRIPT_CLASS_BY_MODE[mode];
    span.textContent = Array.from(text).map(normalizeTypedChar).join("");
    insertNodeAtCursor(span, { ensureTextCursorAfter: true });
    syncValue();
  };

  const exitScriptMode = () => {
    scriptModeRef.current = null;
    setScriptMode(null);
    requestAnimationFrame(() => {
      focusEditor();
      forcePlainCaret();
    });
  };

  const toggleScriptMode = (mode) => {
    focusEditor();
    if (scriptModeRef.current === mode) {
      exitScriptMode();
      return;
    }
    scriptModeRef.current = mode;
    setScriptMode(mode);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      exitScriptMode();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "Tab" || e.key.startsWith("Arrow")) return;
    if (e.key.length !== 1) return;

    const currentMode = scriptModeRef.current;

    if (!currentMode) {
      const activeSpan = ref.current ? findActiveScriptSpan(ref.current) : null;
      if (activeSpan) {
        e.preventDefault();
        insertPlainText(e.key);
      }
      return;
    }

    if (!isAllowedScriptChar(e.key)) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    insertScriptText(e.key, currentMode);
    exitScriptMode();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const currentMode = scriptModeRef.current;

    if (!currentMode) {
      insertPlainText(text);
      return;
    }

    const filtered = Array.from(text).filter((char) => isAllowedScriptChar(char));
    if (filtered.length > 0) {
      insertScriptText(filtered.join(""), currentMode);
    }
  };

  const handleInput = (e) => {
    onChange(e.currentTarget.innerHTML.replace(/​/g, ""));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-700">Invoermodus:</span>
        <span
          className={`rounded-full px-3 py-1 font-medium ${
            scriptMode === "sub"
              ? "bg-sky-100 text-sky-800"
              : scriptMode === "sup"
              ? "bg-violet-100 text-violet-800"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {scriptMode === "sub" ? "Subscript actief" : scriptMode === "sup" ? "Superscript actief" : "Normale tekst"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={scriptMode === "sub" ? "default" : "outline"}
          size="sm"
          className="rounded-2xl"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleScriptMode("sub")}
        >
          <Subscript className="mr-2 h-4 w-4" />
          Subscript
        </Button>

        <Button
          type="button"
          variant={scriptMode === "sup" ? "default" : "outline"}
          size="sm"
          className="rounded-2xl"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleScriptMode("sup")}
        >
          <Superscript className="mr-2 h-4 w-4" />
          Superscript
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-2xl"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (scriptMode) {
              insertScriptText("+", scriptMode);
              exitScriptMode();
            } else {
              insertPlainText("+");
            }
          }}
        >
          +
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-2xl"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (scriptMode) {
              insertScriptText("−", scriptMode);
              exitScriptMode();
            } else {
              insertPlainText("−");
            }
          }}
        >
          −
        </Button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`formula-editor min-h-[64px] rounded-2xl border bg-white px-4 py-3 text-2xl shadow-sm outline-none ring-0 transition focus:shadow-md ${
          scriptMode === "sub"
            ? "border-sky-400 shadow-sky-100"
            : scriptMode === "sup"
            ? "border-violet-400 shadow-violet-100"
            : "border-slate-300 focus:border-slate-500"
        }`}
        data-placeholder={placeholder}
        style={{ whiteSpace: "pre-wrap" }}
      />

      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
        }

        .formula-editor .formula-sub {
          display: inline-block;
          font-size: 0.7em;
          vertical-align: sub;
          line-height: 1;
        }

        .formula-editor .formula-sup {
          display: inline-block;
          font-size: 0.7em;
          vertical-align: super;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}

export default function MolecuulFormulesSite() {
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState(QUESTION_BANK);
  const [mistakeQueue, setMistakeQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentQuestion = questions[index];
  const total = questions.length;
  const finished = started && index >= total;

  const percentage = useMemo(() => {
    if (results.length === 0) return 0;
    const correct = results.filter((r) => r.correct).length;
    return Math.round((correct / results.length) * 100);
  }, [results]);

  const handleStart = () => {
    setQuestions(shuffleArray(QUESTION_BANK));
    setMistakeQueue([]);
    setStarted(true);
    setIndex(0);
    setAnswer("");
    setResults([]);
    setShowFeedback(false);
    setIsCorrect(false);
  };

  const handleRetryMistakes = () => {
    if (mistakeQueue.length === 0) return;
    setQuestions(shuffleArray(mistakeQueue));
    setStarted(true);
    setIndex(0);
    setAnswer("");
    setResults([]);
    setShowFeedback(false);
    setIsCorrect(false);
  };

  const handleCheck = () => {
    if (!currentQuestion) return;
    const correct = scoreAnswer(answer, currentQuestion.answers);
    setIsCorrect(correct);
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (!currentQuestion) return;

    const correct = scoreAnswer(answer, currentQuestion.answers);
    const nextResult = {
      prompt: currentQuestion.prompt,
      studentAnswer: answer,
      correct,
      validAnswers: currentQuestion.answers,
      question: currentQuestion,
    };

    setResults((prev) => {
      const updated = [...prev, nextResult];
      setMistakeQueue(updated.filter((item) => !item.correct).map((item) => item.question));
      return updated;
    });

    setAnswer("");
    setShowFeedback(false);
    setIsCorrect(false);
    setIndex((prev) => prev + 1);
  };

  const handleReset = () => {
    setStarted(false);
    setQuestions(QUESTION_BANK);
    setMistakeQueue([]);
    setIndex(0);
    setAnswer("");
    setResults([]);
    setShowFeedback(false);
    setIsCorrect(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4 md:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-[2rem] border-0 shadow-xl shadow-slate-200/60">
            <CardHeader className="pb-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                  <FlaskConical className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-3xl">Molecuulformules oefenen</CardTitle>
                  <CardDescription className="text-base">
                    Leer stap voor stap makkelijke molecuulformules. Meerdere goede antwoorden zijn mogelijk.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {!started && !finished && (
                <div className="space-y-4">
                  <div className="flex justify-start">
                    <Button onClick={handleStart} className="h-12 rounded-2xl px-6 text-base">
                      Start oefening
                    </Button>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="mb-2 font-semibold text-slate-800">Zo werkt het</p>
                    <ul className="space-y-2 text-slate-600">
                      <li>• Je krijgt steeds één stofnaam te zien.</li>
                      <li>• Vul de molecuulformule in het antwoordvak in.</li>
                      <li>• Gebruik de knopjes voor subscript, superscript, plus en min.</li>
                      <li>• De leerkracht kan per vraag meerdere goede antwoorden instellen.</li>
                    </ul>
                  </div>
                </div>
              )}

              {started && !finished && currentQuestion && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                        Vraag {index + 1} van {total}
                      </p>
                      <h2 className="text-4xl font-bold text-slate-900">{currentQuestion.prompt}</h2>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                      Oefening bezig
                    </div>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${((index + (showFeedback ? 1 : 0)) / total) * 100}%` }}
                    />
                  </div>

                  <div
                    className="rounded-3xl bg-white p-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!showFeedback) {
                          handleCheck();
                        } else {
                          handleNext();
                        }
                      }
                    }}
                  >
                    <FormulaInput value={answer} onChange={setAnswer} placeholder="Typ hier bijvoorbeeld H₂O" />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {!showFeedback ? (
                      <Button onClick={handleCheck} className="rounded-2xl px-6 text-base">
                        Controleer antwoord
                      </Button>
                    ) : (
                      <Button onClick={handleNext} className="rounded-2xl px-6 text-base">
                        Volgende vraag
                      </Button>
                    )}

                    <Button variant="outline" onClick={handleReset} className="rounded-2xl px-6 text-base">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Opnieuw
                    </Button>
                  </div>

                  {showFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-3xl border p-5 ${
                        isCorrect ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                        ) : (
                          <XCircle className="mt-0.5 h-6 w-6 text-red-600" />
                        )}
                        <div>
                          <p className="text-lg font-semibold text-slate-900">
                            {isCorrect ? "Goed gedaan!" : "Nog niet goed."}
                          </p>
                          <p className="text-slate-700">Geldige antwoorden: {currentQuestion.answers.join(" of ")}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {finished && (
                <div className="space-y-6">
                  <div className="rounded-[2rem] bg-slate-900 p-6 text-white">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-2xl bg-white/10 p-3">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold">Klaar!</h2>
                        <p className="text-slate-300">
                          Je hebt {results.filter((r) => r.correct).length} van de {results.length} goed.
                        </p>
                      </div>
                    </div>
                    <div className="text-5xl font-black">{percentage}%</div>
                  </div>

                  <div className="space-y-3">
                    {results.map((result, idx) => (
                      <div
                        key={`${result.prompt}-${idx}`}
                        className={`rounded-3xl border p-4 ${
                          result.correct ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                          {result.correct ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          {result.prompt}
                        </div>
                        <p className="text-slate-700">
                          Jouw antwoord: <span dangerouslySetInnerHTML={{ __html: result.studentAnswer || "—" }} />
                        </p>
                        {!result.correct && (
                          <p className="text-slate-700">Goede antwoorden: {result.validAnswers.join(" of ")}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {mistakeQueue.length > 0 && (
                      <Button onClick={handleRetryMistakes} className="rounded-2xl px-6 text-base">
                        Oefen alleen fouten opnieuw
                      </Button>
                    )}
                    <Button onClick={handleReset} className="rounded-2xl px-6 text-base">
                      Nog een keer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="space-y-6">
            <Card className="rounded-[2rem] border-0 shadow-lg shadow-slate-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Superscript className="h-5 w-5" />
                  Subscript en superscript invoeren (x₂ en x²)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700">
                <p>Gebruik de knopjes om bijvoorbeeld H₂O of SO₄²⁻ te schrijven.</p>
                <p className="font-medium">Voorbeeld: SO₄²⁻ typen</p>
                <ol className="list-decimal ml-5 space-y-2">
                  <li>
                    Typ <strong>SO</strong>
                  </li>
                  <li className="flex items-center gap-2 flex-wrap">
                    Klik op
                    <span className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs bg-white">
                      <Subscript className="h-3 w-3" /> Subscript
                    </span>
                    en typ <strong>4</strong>
                  </li>
                  <li className="flex items-center gap-2 flex-wrap">
                    Klik op
                    <span className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs bg-white">
                      <Superscript className="h-3 w-3" /> Superscript
                    </span>
                    en typ <strong>2</strong>
                  </li>
                  <li className="flex items-center gap-2 flex-wrap">
                    Klik opnieuw op
                    <span className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs bg-white">
                      <Superscript className="h-3 w-3" /> Superscript
                    </span>
                    en klik daarna op
                    <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1 text-xs bg-white">−</span>
                  </li>
                </ol>
                <p>Resultaat: <strong>SO₄²⁻</strong></p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-0 shadow-lg shadow-slate-200/60">
              <CardHeader>
                <CardTitle className="text-xl">Voor de leerkracht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-slate-700">
                <p>Open bovenaan in de code de lijst <code>QUESTION_BANK</code>.</p>
                <p>Daar kun je eenvoudig jouw eigen woorden en juiste formules invoeren.</p>
                <p>Je kunt per vraag meerdere goede antwoorden toevoegen in de <code>answers</code>-lijst.</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
