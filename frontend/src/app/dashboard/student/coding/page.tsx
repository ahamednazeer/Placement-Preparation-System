'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowClockwise,
    Brain,
    ChartLineUp,
    Clock,
    Code,
    Target,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

import { useCapacitor } from '@/components/CapacitorProvider';
import {
    api,
    CodingAttemptResponse,
    CodingEvaluationResponse,
    CodingExplanationResponse,
    CodingHintResponse,
    CodingLanguage,
    CodingProblem,
    DifficultyLevel,
} from '@/lib/api';

const LANGUAGE_TEMPLATES: Record<CodingLanguage, string> = {
    PYTHON: `def solve():
    import sys
    data = sys.stdin.read().strip().split()
    if not data:
        return
    # TODO: implement
    # print(result)

if __name__ == "__main__":
    solve()
`,
    JAVASCRIPT: `'use strict';

const fs = require('fs');
const input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);
if (input.length === 1 && input[0] === '') process.exit(0);
// TODO: implement
// process.stdout.write(String(result));
`,
    JAVA: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        FastScanner fs = new FastScanner(System.in);
        // TODO: implement
        // System.out.print(result);
    }

    static class FastScanner {
        private final InputStream in;
        private final byte[] buffer = new byte[1 << 16];
        private int ptr = 0, len = 0;
        FastScanner(InputStream is) { in = is; }
        private int read() throws IOException {
            if (ptr >= len) {
                len = in.read(buffer);
                ptr = 0;
                if (len <= 0) return -1;
            }
            return buffer[ptr++];
        }
        String next() throws IOException {
            StringBuilder sb = new StringBuilder();
            int c;
            while ((c = read()) != -1 && c <= ' ') {}
            if (c == -1) return null;
            do { sb.append((char)c); } while ((c = read()) != -1 && c > ' ');
            return sb.toString();
        }
    }
}
`,
    CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // TODO: implement
    return 0;
}
`,
    C: `#include <stdio.h>

int main() {
    // TODO: implement
    return 0;
}
`,
};

const verdictStyles: Record<string, string> = {
    ACCEPTED: 'text-green-400 bg-green-950/40 border-green-800',
    PARTIAL: 'text-yellow-400 bg-yellow-950/40 border-yellow-800',
    WRONG_ANSWER: 'text-red-400 bg-red-950/40 border-red-800',
    RUNTIME_ERROR: 'text-red-400 bg-red-950/40 border-red-800',
    TIME_LIMIT: 'text-orange-400 bg-orange-950/40 border-orange-800',
    COMPILE_ERROR: 'text-red-400 bg-red-950/40 border-red-800',
};

export default function CodingPracticePage() {
    const { hapticImpact } = useCapacitor();
    const [difficulty, setDifficulty] = useState<DifficultyLevel>('MEDIUM');
    const [topic, setTopic] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [language, setLanguage] = useState<CodingLanguage>('PYTHON');
    const [code, setCode] = useState(LANGUAGE_TEMPLATES.PYTHON);
    const [problem, setProblem] = useState<CodingProblem | null>(null);
    const [loadingProblem, setLoadingProblem] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [evaluation, setEvaluation] = useState<CodingEvaluationResponse | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    const [hintLoading, setHintLoading] = useState(false);
    const [explanation, setExplanation] = useState<CodingExplanationResponse | null>(null);
    const [explainLoading, setExplainLoading] = useState(false);

    const tags = useMemo(
        () => tagInput.split(',').map((t) => t.trim()).filter(Boolean),
        [tagInput]
    );

    const generateProblem = useCallback(async () => {
        setLoadingProblem(true);
        setEvaluation(null);
        setHint(null);
        setExplanation(null);
        try {
            const response = await api.generateCodingProblem({
                difficulty,
                tags: tags.length ? tags : undefined,
                topic: topic.trim() || undefined,
            });
            setProblem(response);
            toast.success('Problem generated');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to generate problem');
        } finally {
            setLoadingProblem(false);
        }
    }, [difficulty, tags, topic]);

    const initialLoad = useRef(false);
    useEffect(() => {
        if (!initialLoad.current) {
            initialLoad.current = true;
            generateProblem();
        }
    }, [generateProblem]);

    useEffect(() => {
        if (!code.trim()) {
            setCode(LANGUAGE_TEMPLATES[language]);
        }
    }, [language, code]);

    const handleSubmit = async () => {
        if (!problem) {
            toast.error('Generate a problem first');
            return;
        }
        if (!code.trim()) {
            toast.error('Write your solution before submitting');
            return;
        }
        setSubmitting(true);
        try {
            const response: CodingAttemptResponse = await api.submitCodingAttempt({
                problem_id: problem.id,
                language,
                code,
            });
            setEvaluation(response.evaluation);
            toast.success('AI evaluation completed');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to evaluate solution');
        } finally {
            setSubmitting(false);
        }
    };

    const handleHint = async () => {
        if (!problem) {
            toast.error('Generate a problem first');
            return;
        }
        setHintLoading(true);
        try {
            const response: CodingHintResponse = await api.getCodingHint(problem.id, {
                code: code.trim() || undefined,
                hint_level: 'MEDIUM',
            });
            setHint(response.hint);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch hint');
        } finally {
            setHintLoading(false);
        }
    };

    const handleExplain = async () => {
        if (!problem) {
            toast.error('Generate a problem first');
            return;
        }
        setExplainLoading(true);
        try {
            const response = await api.getCodingExplanation(problem.id);
            setExplanation(response);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch explanation');
        } finally {
            setExplainLoading(false);
        }
    };

    const verdict = evaluation?.verdict || '';
    const verdictClass = verdictStyles[verdict] || 'text-slate-300 bg-slate-800/40 border-slate-700';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="card p-6 border-green-800/30 bg-gradient-to-br from-green-900/10 to-slate-900/40">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-green-600">
                            <Code size={24} weight="duotone" className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-chivo font-bold uppercase tracking-wider">Coding Arena</h2>
                            <p className="text-sm text-slate-400 mt-1">
                                AI-generated coding challenges with Groq evaluation.
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Note: Evaluation is AI-based and does not execute code.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            className="input-modern text-xs uppercase tracking-wider"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                        >
                            <option value="EASY">Easy</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HARD">Hard</option>
                        </select>
                        <button
                            onClick={() => { hapticImpact(); generateProblem(); }}
                            className="btn-primary flex items-center gap-2 btn-ripple"
                            disabled={loadingProblem}
                        >
                            <ArrowClockwise size={16} />
                            {loadingProblem ? 'Generating...' : 'New Problem'}
                        </button>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                        className="input-modern text-sm"
                        placeholder="Topic focus (e.g., arrays, dp)"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                    />
                    <input
                        className="input-modern text-sm"
                        placeholder="Tags (comma separated)"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div className="card">
                        {problem ? (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-100">{problem.title}</h3>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Difficulty: {problem.difficulty}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="px-2 py-1 border border-slate-700 rounded-sm text-slate-300">
                                            <Clock size={12} className="inline mr-1" />
                                            {problem.time_limit_ms} ms
                                        </span>
                                        <span className="px-2 py-1 border border-slate-700 rounded-sm text-slate-300">
                                            <Target size={12} className="inline mr-1" />
                                            {problem.memory_limit_mb} MB
                                        </span>
                                    </div>
                                </div>

                                {problem.tags?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                        {problem.tags.map((tag) => (
                                            <span key={tag} className="text-xs px-2 py-1 rounded-sm bg-slate-800 text-slate-300">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                <div className="text-sm text-slate-300 whitespace-pre-wrap">
                                    {problem.description}
                                </div>

                                {problem.input_format && (
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-400">Input</p>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap mt-1">{problem.input_format}</p>
                                    </div>
                                )}

                                {problem.output_format && (
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-400">Output</p>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap mt-1">{problem.output_format}</p>
                                    </div>
                                )}

                                {problem.constraints && (
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-400">Constraints</p>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap mt-1">{problem.constraints}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500">Generating problem...</div>
                        )}
                    </div>

                    <div className="card">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Sample Cases</h4>
                        {problem?.sample_test_cases?.length ? (
                            <div className="space-y-3">
                                {problem.sample_test_cases.map((sample, idx) => (
                                    <div key={`${sample.input}-${idx}`} className="bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                                        <p className="text-xs text-slate-500">Input</p>
                                        <pre className="text-sm text-slate-200 whitespace-pre-wrap mt-1">{sample.input}</pre>
                                        <p className="text-xs text-slate-500 mt-3">Output</p>
                                        <pre className="text-sm text-slate-200 whitespace-pre-wrap mt-1">{sample.expected_output}</pre>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">No samples available yet.</p>
                        )}
                    </div>

                    <div className="card">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">AI Assist</h4>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => { hapticImpact(); handleHint(); }}
                                className="btn-secondary flex items-center gap-2 btn-ripple"
                                disabled={hintLoading}
                            >
                                <Brain size={16} />
                                {hintLoading ? 'Thinking...' : 'Get Hint'}
                            </button>
                            <button
                                onClick={() => { hapticImpact(); handleExplain(); }}
                                className="btn-secondary flex items-center gap-2 btn-ripple"
                                disabled={explainLoading}
                            >
                                <ChartLineUp size={16} />
                                {explainLoading ? 'Loading...' : 'Explain Solution'}
                            </button>
                        </div>
                        {hint && (
                            <div className="mt-4 text-sm text-slate-300 bg-slate-950/60 border border-slate-800 rounded-sm p-3 whitespace-pre-wrap">
                                {hint}
                            </div>
                        )}
                        {explanation && (
                            <div className="mt-4 space-y-3 text-sm text-slate-300">
                                <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-3 whitespace-pre-wrap">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Approach</p>
                                    {explanation.approach}
                                </div>
                                <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-3 whitespace-pre-wrap">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Pseudocode</p>
                                    {explanation.pseudocode}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Complexity</p>
                                        <p>Time: {explanation.complexity?.time || 'Unknown'}</p>
                                        <p>Space: {explanation.complexity?.space || 'Unknown'}</p>
                                    </div>
                                    <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Edge Cases</p>
                                        {explanation.edge_cases?.length ? (
                                            <ul className="space-y-1">
                                                {explanation.edge_cases.map((edge, idx) => (
                                                    <li key={`${edge}-${idx}`}>{edge}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>None listed</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="card">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">Editor</h4>
                            <div className="flex items-center gap-2">
                                <select
                                    className="input-modern text-xs uppercase tracking-wider"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as CodingLanguage)}
                                >
                                    <option value="PYTHON">Python</option>
                                    <option value="JAVA">Java</option>
                                    <option value="CPP">C++</option>
                                    <option value="JAVASCRIPT">JavaScript</option>
                                    <option value="C">C</option>
                                </select>
                                <button
                                    onClick={() => { hapticImpact(); setCode(LANGUAGE_TEMPLATES[language]); }}
                                    className="btn-secondary btn-ripple text-xs px-3"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                        <textarea
                            className="input-modern font-mono text-sm min-h-[360px] resize-y"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            spellCheck={false}
                        />
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => { hapticImpact(); handleSubmit(); }}
                                className="btn-primary flex items-center gap-2 btn-ripple"
                                disabled={submitting}
                            >
                                <Code size={16} />
                                {submitting ? 'Evaluating...' : 'Submit to Groq'}
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Evaluation</h4>
                        {evaluation ? (
                            <div className="space-y-4">
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-sm border text-xs ${verdictClass}`}>
                                    {evaluation.verdict}
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                                    <div>Score: <span className="font-mono">{evaluation.score}</span></div>
                                    <div>
                                        Tests: <span className="font-mono">{evaluation.tests_passed}/{evaluation.tests_total}</span>
                                    </div>
                                </div>
                                {evaluation.feedback && (
                                    <div className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                                        {evaluation.feedback}
                                    </div>
                                )}
                                {evaluation.complexity && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Time</p>
                                            {evaluation.complexity.time || 'Unknown'}
                                        </div>
                                        <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-3">
                                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Space</p>
                                            {evaluation.complexity.space || 'Unknown'}
                                        </div>
                                    </div>
                                )}
                                {evaluation.key_issues?.length ? (
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Key Issues</p>
                                        <ul className="space-y-1 text-sm text-slate-300">
                                            {evaluation.key_issues.map((issue, idx) => (
                                                <li key={`${issue}-${idx}`}>{issue}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {evaluation.improvement_tips?.length ? (
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Improvement Tips</p>
                                        <ul className="space-y-1 text-sm text-slate-300">
                                            {evaluation.improvement_tips.map((tip, idx) => (
                                                <li key={`${tip}-${idx}`}>{tip}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}
                                {evaluation.failed_cases?.length ? (
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Failed Cases</p>
                                        <div className="space-y-3">
                                            {evaluation.failed_cases.map((fc, idx) => (
                                                <div key={`fail-${idx}`} className="bg-slate-950/60 border border-slate-800 rounded-sm p-3 text-sm">
                                                    <div className="text-xs text-slate-500">Input</div>
                                                    <pre className="whitespace-pre-wrap text-slate-200 mt-1">{fc.input}</pre>
                                                    <div className="text-xs text-slate-500 mt-3">Expected</div>
                                                    <pre className="whitespace-pre-wrap text-slate-200 mt-1">{fc.expected_output}</pre>
                                                    {fc.actual_output !== undefined && (
                                                        <>
                                                            <div className="text-xs text-slate-500 mt-3">Actual</div>
                                                            <pre className="whitespace-pre-wrap text-slate-200 mt-1">{fc.actual_output}</pre>
                                                        </>
                                                    )}
                                                    {fc.reason && (
                                                        <div className="text-xs text-slate-500 mt-3">Reason: {fc.reason}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">Submit your solution to see evaluation.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
