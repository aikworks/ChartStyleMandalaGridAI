import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Trash2, Info, Lightbulb, Zap, Download, X, ZoomIn, Maximize, Grid3x3, Copy, Check, Palette, FileText, Printer, Import, AlertCircle, Loader2, Bot, Eraser, Settings, Edit3, RotateCcw, RotateCw, Eye } from 'lucide-react';

// マンダラチャートの構造ロジック
const INITIAL_DATA = Array(81).fill('');
const CENTER_INDEX = 40;
const BLOCK_CENTERS = [10, 13, 16, 37, 40, 43, 64, 67, 70];
const CENTER_BLOCK_MAPPING = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Gemini API Key (Backend Proxy)
// const apiKey = ""; 

// 文字色設定
const TEXT_COLOR_CLASS = "text-slate-900";

// 文字数制限
const MAX_VISUAL_LENGTH = 30;

// --- Helper Functions ---

const countVisualLength = (str) => {
    if (!str) return 0;
    let length = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if ((c >= 0x00 && c <= 0x7F) || (c >= 0xFF61 && c <= 0xFF9F)) {
            length += 0.5;
        } else {
            length += 1;
        }
    }
    return length;
};

// ヒント提案用データベース
const SUGGESTION_DB = {
    health: {
        keywords: ['健康', '体', '痩', 'ダイエット', '病気', '運動', '筋トレ', '睡眠', '食事', 'ヘルス'],
        subThemes: ['食事管理', '睡眠の質', '筋力強化', 'メンタル', '柔軟性', '有酸素', '検診・ケア', '生活習慣'],
        actions: ['野菜摂取', '7時間睡眠', 'ジム通い', '瞑想', 'ストレッチ', '散歩', '水分補給', '糖質制限']
    },
    framework: {
        general: ['心（メンタル）', '技（スキル）', '体（健康）', '生活（環境）', '趣味（遊び）', '金（資産）', '人（関係）', '知（学習）'],
    }
};



const getRandomItems = (array, n) => {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
};

const getBlockIndex = (cellIndex) => {
    if (cellIndex === null) return -1;
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    const blockRow = Math.floor(row / 3);
    const blockCol = Math.floor(col / 3);
    return blockRow * 3 + blockCol;
};

const getLocalIndex = (cellIndex) => {
    const row = Math.floor(cellIndex / 9) % 3;
    const col = cellIndex % 9 % 3;
    return row * 3 + col;
};

const getGlobalIndex = (blockIdx, localIdx) => {
    const blockRow = Math.floor(blockIdx / 3);
    const blockCol = blockIdx % 3;
    const localRow = Math.floor(localIdx / 3);
    const localCol = localIdx % 3;
    return (blockRow * 3 + localRow) * 9 + (blockCol * 3 + localCol);
};

const loadHtml2Canvas = () => {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) {
            resolve(window.html2canvas);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => resolve(window.html2canvas);
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

const copyToClipboard = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textarea);
};

const callGeminiAPI = async (prompt, systemInstruction = "") => {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, systemInstruction }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error("Gemini API call failed:", error);
        throw error;
    }
};

const generatePlainTree = (data) => {
    const centerTheme = data[CENTER_INDEX] || "無題のテーマ";
    let text = `■ ${centerTheme}\n\n`;
    const subBlockIndices = [0, 1, 2, 3, 5, 6, 7, 8];
    subBlockIndices.forEach((blockIndex, i) => {
        const isLastSub = i === subBlockIndices.length - 1;
        const subThemeIndex = getGlobalIndex(4, blockIndex);
        const subTheme = data[subThemeIndex] || `(未設定)`;
        const subPrefix = isLastSub ? '└─ ' : '├─ ';
        const subNum = i + 1;
        text += `${subPrefix}${subNum}. ${subTheme}\n`;
        const detailIndices = [0, 1, 2, 3, 5, 6, 7, 8];
        detailIndices.forEach((localIdx, j) => {
            const isLastDetail = j === detailIndices.length - 1;
            const detailIndex = getGlobalIndex(blockIndex, localIdx);
            const detail = data[detailIndex];
            if (detail) {
                const indent = isLastSub ? '   ' : '│  ';
                const detailPrefix = isLastDetail ? '└─ ' : '├─ ';
                const detailNum = `${subNum}-${j + 1}`;
                text += `${indent}${detailPrefix}${detailNum}. ${detail}\n`;
            }
        });
        if (!isLastSub) text += '│\n';
    });
    return text;
};

const generateMarkdown = (data) => {
    const centerTheme = data[CENTER_INDEX] || "無題のテーマ";
    let text = `# ${centerTheme}\n\n`;
    for (let i = 0; i < 9; i++) {
        if (i === 4) continue;
        const subThemeIndex = getGlobalIndex(4, i);
        const subTheme = data[subThemeIndex] || `サブテーマ${i + 1}`;
        text += `## ${subTheme}\n`;
        for (let j = 0; j < 9; j++) {
            if (j === 4) continue;
            const detailIndex = getGlobalIndex(i, j);
            const detail = data[detailIndex];
            if (detail) {
                text += `- [ ] ${detail}\n`;
            }
        }
        text += "\n";
    }
    return text;
};

const parseMarkdown = (text) => {
    const lines = text.split('\n');
    const newData = Array(81).fill('');
    let currentBlockIndex = -1;
    const subThemeBlockIndices = [0, 1, 2, 3, 5, 6, 7, 8];
    let subThemePointer = 0;
    const detailIndices = [0, 1, 2, 3, 5, 6, 7, 8];
    let detailPointer = 0;
    lines.forEach((line) => {
        const trimmed = line.replace(/^[\s\u3000\u00A0]+|[\s\u3000\u00A0]+$/g, '');
        if (!trimmed) return;
        if (/^#[^#]/.test(trimmed)) {
            const text = trimmed.replace(/^#+[\s\u3000\u00A0]*/, '').trim();
            newData[CENTER_INDEX] = text;
            return;
        }
        if (/^##/.test(trimmed)) {
            if (subThemePointer < subThemeBlockIndices.length) {
                currentBlockIndex = subThemeBlockIndices[subThemePointer];
                const themeText = trimmed.replace(/^##+[\s\u3000\u00A0]*/, '').trim();
                const centerBlockCellIndex = getGlobalIndex(4, currentBlockIndex);
                newData[centerBlockCellIndex] = themeText;
                const subBlockCenterIndex = getGlobalIndex(currentBlockIndex, 4);
                newData[subBlockCenterIndex] = themeText;
                subThemePointer++;
                detailPointer = 0;
            }
            return;
        }
        if (/^[-*+•]/.test(trimmed)) {
            if (currentBlockIndex !== -1 && detailPointer < detailIndices.length) {
                let itemText = trimmed.replace(/^[-*+•][\s\u3000\u00A0]*/, '');
                itemText = itemText.replace(/^\[[ xX\s]*?\][\s\u3000\u00A0]*/, '');
                itemText = itemText.trim();
                const localIdx = detailIndices[detailPointer];
                const globalIdx = getGlobalIndex(currentBlockIndex, localIdx);
                newData[globalIdx] = itemText;
                detailPointer++;
            }
        }
    });
    return newData;
};

const getImportTemplate = () => {
    let template = `# メインテーマ\n\n`;
    for (let i = 1; i <= 8; i++) {
        template += `## サブテーマ${i}\n`;
        for (let j = 1; j <= 8; j++) {
            template += `- [ ] 行動${i}-${j}\n`;
        }
        template += "\n";
    }
    return template;
};

// トースト通知
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    if (!message) return null;
    const bgClass = type === 'error' ? 'bg-red-500' : 'bg-slate-800';

    return (
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 ${bgClass} text-white px-6 py-3 rounded-full shadow-xl z-[100] animate-fadeIn flex items-center gap-2 pointer-events-none whitespace-nowrap`}>
            {type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
            <span className="text-sm font-bold">{message}</span>
        </div>
    );
};

const THEMES = {
    blue: { id: 'blue', name: 'Blue', color: 'bg-blue-500', center: 'bg-blue-200 ring-blue-300', sub: 'bg-blue-50', base: 'bg-white', accent: 'bg-blue-600', accentHover: 'hover:bg-blue-700', title: 'from-blue-600 to-indigo-600', border: 'border-blue-200' },
    cyan: { id: 'cyan', name: 'Cyan', color: 'bg-cyan-400', center: 'bg-cyan-200 ring-cyan-300', sub: 'bg-cyan-50', base: 'bg-white', accent: 'bg-cyan-600', accentHover: 'hover:bg-cyan-700', title: 'from-cyan-500 to-blue-500', border: 'border-cyan-200' },
    green: { id: 'green', name: 'Green', color: 'bg-emerald-500', center: 'bg-emerald-200 ring-emerald-300', sub: 'bg-emerald-50', base: 'bg-white', accent: 'bg-emerald-600', accentHover: 'hover:bg-emerald-700', title: 'from-emerald-600 to-green-600', border: 'border-emerald-200' },
    yellow: { id: 'yellow', name: 'Orange Yellow', color: 'bg-orange-400', center: 'bg-orange-200 ring-orange-300', sub: 'bg-orange-50', base: 'bg-white', accent: 'bg-orange-500', accentHover: 'hover:bg-orange-600', title: 'from-orange-400 to-yellow-500', border: 'border-orange-200' },
    gold: { id: 'gold', name: 'Gold', color: 'bg-yellow-600', center: 'bg-yellow-200 ring-yellow-400', sub: 'bg-yellow-50', base: 'bg-white', accent: 'bg-yellow-700', accentHover: 'hover:bg-yellow-800', title: 'from-yellow-600 to-amber-600', border: 'border-yellow-200' },
    red: { id: 'red', name: 'Red', color: 'bg-red-600', center: 'bg-red-200 ring-red-300', sub: 'bg-red-50', base: 'bg-white', accent: 'bg-red-600', accentHover: 'hover:bg-red-700', title: 'from-red-600 to-red-800', border: 'border-red-200' },
    pink: { id: 'pink', name: 'Pink', color: 'bg-pink-400', center: 'bg-pink-200 ring-pink-300', sub: 'bg-pink-50', base: 'bg-white', accent: 'bg-pink-500', accentHover: 'hover:bg-pink-600', title: 'from-pink-500 to-rose-500', border: 'border-pink-200' },
    purple: { id: 'purple', name: 'Purple', color: 'bg-purple-500', center: 'bg-purple-200 ring-purple-300', sub: 'bg-purple-50', base: 'bg-white', accent: 'bg-purple-600', accentHover: 'hover:bg-purple-700', title: 'from-purple-600 to-violet-600', border: 'border-purple-200' },
    gray: { id: 'gray', name: 'Silver', color: 'bg-slate-400', center: 'bg-slate-200 ring-slate-300', sub: 'bg-slate-50', base: 'bg-white', accent: 'bg-slate-500', accentHover: 'hover:bg-slate-600', title: 'from-slate-400 to-slate-600', border: 'border-slate-200' },
    white: { id: 'white', name: 'Simple', color: 'bg-white', center: 'bg-white border-2 border-slate-800 ring-slate-400', sub: 'bg-white border border-slate-400', base: 'bg-white', accent: 'bg-black', accentHover: 'hover:bg-slate-800', title: 'from-slate-800 to-black', border: 'border-slate-300' }
};

const ImagePreviewModal = ({ isOpen, onClose, imageData }) => {
    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => { if (!isOpen && imageData) URL.revokeObjectURL(imageData); }, [isOpen, imageData]);

    useEffect(() => {
        if (isOpen) setIsFullScreen(false);
    }, [isOpen]);

    if (!isOpen || !imageData) return null;

    if (isFullScreen) {
        return (
            <div className="fixed inset-0 bg-black z-[70] flex flex-col items-center justify-center animate-fadeIn no-print" onClick={(e) => e.stopPropagation()}>
                <div className="relative w-full h-full flex items-center justify-center p-2">
                    <img src={imageData} alt="Mandala Chart Full" className="max-w-full max-h-full object-contain pointer-events-auto" />
                    <button
                        onClick={() => setIsFullScreen(false)}
                        className="absolute top-4 right-4 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 pointer-events-auto"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="absolute bottom-8 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-bold pointer-events-none">
                    長押しで保存してください
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn no-print" onClick={onClose}>
            <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-700">画像を保存</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center gap-4">
                    <button
                        onClick={() => setIsFullScreen(true)}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-md"
                    >
                        <Eye className="w-5 h-5" />
                        画像を拡大・保存しやすくする
                    </button>

                    <p className="text-sm text-red-600 font-bold text-center bg-red-50 p-2 rounded-lg w-full animate-pulse">
                        👇 画像を長押しして保存してください
                    </p>

                    <div className="w-full border-2 border-slate-200 rounded-lg overflow-hidden shadow-sm min-h-[250px] bg-slate-100 flex items-center justify-center">
                        <img src={imageData} alt="Mandala Chart" className="w-full h-auto object-contain" />
                    </div>

                    <div className="text-xs text-slate-500 space-y-3 bg-slate-100 p-3 rounded-lg w-full">
                        <div><p className="font-bold text-slate-700 mb-1">📱 スマホの方:</p><p className="pl-2 leading-relaxed">画像を<span className="font-bold text-slate-700">長押し</span>して「写真に保存」を選択<span className="block text-[10px] text-slate-400 mt-0.5">※機種によってできない場合はスクショ</span></p></div>
                        <div><p className="font-bold text-slate-700 mb-1">💻 PC / Macの方:</p><p className="pl-2 leading-relaxed">画像を<span className="font-bold text-slate-700">右クリック（副クリック）</span>して「名前を付けて画像（イメージ）を保存」を選択</p></div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50">
                    <button onClick={onClose} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors">閉じる</button>
                </div>
            </div>
        </div>
    );
};

const TextExportModal = ({ isOpen, onClose, data, showToast }) => {
    const [copied, setCopied] = useState(false);
    const [isMarkdown, setIsMarkdown] = useState(false);
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    const text = isMarkdown ? generateMarkdown(data) : generatePlainTree(data);
    const handleCopy = () => {
        copyToClipboard(text);
        setCopied(true);
        showToast("コピーしました！", "success");
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn no-print" onClick={onClose}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start">
                    <div className="space-y-1"><h3 className="text-xl font-bold text-slate-800">テキスト出力</h3><p className="text-sm text-slate-500">データをテキストとしてコピーします</p></div>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <input type="checkbox" id="md-check" checked={isMarkdown} onChange={(e) => setIsMarkdown(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                    <label htmlFor="md-check" className="cursor-pointer select-none font-medium">Markdown形式（再インポート用）</label>
                </div>
                <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-slate-600 h-60 overflow-y-auto whitespace-pre-wrap border border-slate-200">{text}</div>
                <button onClick={handleCopy} className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-green-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>{copied ? <><Check className="w-5 h-5" /> コピーしました</> : <><Copy className="w-5 h-5" /> クリップボードにコピー</>}</button>
            </div>
        </div>
    );
};

const ImportModal = ({ isOpen, onClose, onImport, showToast }) => {
    const [inputText, setInputText] = useState('');
    const [copied, setCopied] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    useEffect(() => { if (isOpen) setErrorMsg(null); }, [isOpen]);
    if (!isOpen) return null;
    const handleCopyTemplate = () => {
        copyToClipboard(getImportTemplate());
        setCopied(true);
        showToast("テンプレートをコピーしました", "success");
        setTimeout(() => setCopied(false), 2000);
    };
    const handleImport = () => {
        if (!inputText.trim()) { setErrorMsg("テキストが入力されていません。"); return; }
        try {
            const result = onImport(inputText);
            if (result) { showToast("データを取り込みました！", "success"); onClose(); setInputText(''); } else { setErrorMsg('インポートに失敗しました。'); }
        } catch (e) { setErrorMsg('エラーが発生しました: ' + e.message); }
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn no-print" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start"><div className="space-y-1"><h3 className="text-xl font-bold text-slate-800">データ取り込み</h3><p className="text-sm text-slate-500">Markdown形式のテキストを貼り付けて反映します</p></div><button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
                <div className="space-y-2">
                    <button onClick={handleCopyTemplate} className={`w-full py-2 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all border ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'テンプレートをコピーしました' : 'テンプレートをコピーする'}</button>
                    <div className="relative">
                        <textarea className="w-full h-64 p-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-900" placeholder={`# メインテーマ\n\n## サブテーマ1\n- [ ] 行動1\n- [ ] 行動2\n...`} value={inputText} onChange={(e) => { setInputText(e.target.value); if (errorMsg) setErrorMsg(null); }} />
                        <div className="absolute bottom-2 right-2 text-xs text-slate-400 bg-white/80 px-1 rounded border border-slate-100 shadow-sm pointer-events-none">{inputText.length}文字</div>
                    </div>
                    {errorMsg && <div className="text-red-500 text-xs font-bold flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3" /> {errorMsg}</div>}
                    <p className="text-[10px] text-slate-400 text-center">※「反映する」を押すと現在のデータは上書きされます</p>
                </div>
                <button onClick={handleImport} className="w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95"><Import className="w-5 h-5" />反映する</button>
            </div>
        </div>
    );
};

const AdviceModal = ({ isOpen, onClose, adviceText, isLoading }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn no-print" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-indigo-50"><div className="flex items-center gap-2 text-indigo-800"><Bot className="w-6 h-6" /><h3 className="font-bold text-lg">AIコーチからのアドバイス</h3></div><button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400"><X className="w-5 h-5" /></button></div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {isLoading ? (<div className="flex flex-col items-center justify-center h-40 gap-4 text-indigo-600"><Loader2 className="w-10 h-10 animate-spin" /><p className="font-bold animate-pulse">チャートを分析中...</p></div>) : (<div className="prose prose-sm prose-indigo max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">{adviceText || "アドバイスを取得できませんでした。"}</div>)}
                </div>
                <div className="p-4 border-t bg-slate-50"><button onClick={onClose} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">閉じる</button></div>
            </div>
        </div>
    );
};

const TitleEditModal = ({ isOpen, onClose, title, subtitle, onSave }) => {
    const [tempTitle, setTempTitle] = useState(title);
    const [tempSubtitle, setTempSubtitle] = useState(subtitle);

    useEffect(() => {
        setTempTitle(title);
        setTempSubtitle(subtitle);
    }, [title, subtitle, isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(tempTitle, tempSubtitle);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm no-print" onClick={onClose}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">タイトル設定</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-500">タイトル</label>
                        <input
                            type="text"
                            autoFocus
                            maxLength={30}
                            className="w-full text-lg p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-900"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-500">サブタイトル (印刷用)</label>
                        <input
                            type="text"
                            maxLength={50}
                            className="w-full text-lg p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-900"
                            value={tempSubtitle}
                            onChange={(e) => setTempSubtitle(e.target.value)}
                        />
                    </div>
                    <div className="pt-2">
                        <button
                            onClick={handleSave}
                            className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-md"
                        >
                            保存する
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const EditModal = ({ isOpen, onClose, value, onChange, cellIndex, onHintSuggest, isAiLoading, theme, onClearBlock, onCommitEdit }) => {
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value, isOpen]);

    useEffect(() => {
        if (isOpen) setIsConfirmingClear(false);
    }, [isOpen]);

    const handleDecide = () => {
        onCommitEdit();
        onClose();
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                handleDecide();
            }
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, localValue]);

    if (!isOpen) return null;

    const isBlockCenterCell = BLOCK_CENTERS.includes(cellIndex);
    const isMainCenter = cellIndex === CENTER_INDEX;
    const visualLength = countVisualLength(localValue);
    const isLengthOver = visualLength > MAX_VISUAL_LENGTH;

    // 既にデータがある場合は autoFocus を無効にする (スマホでのキーボードポップアップ防止)
    const shouldAutoFocus = !value || value.length === 0;

    const handleInputChange = (e) => {
        const val = e.target.value;
        setLocalValue(val);
        onChange(val);
    };

    const handleClear = () => {
        setLocalValue('');
        onChange('');
    };



    const handleAiAction = (mode) => {
        if (isMainCenter && !localValue.trim()) {
            alert("AI機能を使う前に、まずはメインテーマを入力して「決定」してください。");
            return;
        }
        onHintSuggest(mode, localValue);
    };

    const handleClearBlockClick = () => {
        if (isConfirmingClear) {
            onClearBlock();
            setIsConfirmingClear(false);
        } else {
            setIsConfirmingClear(true);
            setTimeout(() => setIsConfirmingClear(false), 3000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm no-print" onClick={onClose}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all relative" onClick={(e) => e.stopPropagation()}>

                {/* 右上閉じるボタンはそのまま維持（PC等で慣れている人用） */}
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>

                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">アイデアを編集</h3>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="text-sm font-medium text-slate-500">
                                {isMainCenter ? "★ メインテーマ（大目標）" : isBlockCenterCell ? "◆ サブテーマ（中目標）" : "・ 具体的なアクション / ToDo"}
                            </label>
                            <span className={`text-xs font-mono transition-colors ${isLengthOver ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                {Math.floor(visualLength * 10) / 10} / {MAX_VISUAL_LENGTH}
                            </span>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                autoFocus={shouldAutoFocus} // データがあるときはフォーカスしない
                                className={`w-full text-lg p-3 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-900 ${isLengthOver ? 'border-red-300 ring-red-200 bg-red-50' : ''}`}
                                placeholder={isBlockCenterCell ? "例: 体力をつける" : "例: 毎日30分歩く"}
                                value={localValue}
                                onChange={handleInputChange}
                            />
                            {localValue && (
                                <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200 rounded-full transition-all" title="消去">
                                    <Eraser className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {isLengthOver && <p className="text-[10px] text-red-500 font-bold text-right">※文字数が多すぎると枠からはみ出す可能性があります</p>}
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex gap-2 items-start">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                            {isMainCenter ? "中心のテーマを入力します。他のブロックの中心にも連動します。" : isBlockCenterCell ? "「どうなる」「どうする」といった短いフレーズで書くと効果的です。" : "具体的な行動（ToDo）や数値目標を書き出しましょう。"}
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <button onClick={handleDecide} className={`w-full py-3 px-6 rounded-xl font-bold text-white shadow-md transition-all active:scale-95 mb-2 bg-gradient-to-r ${theme.title} hover:opacity-90`}>
                            完了
                        </button>

                        <div className="flex flex-col gap-2">
                            {isMainCenter ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleAiAction('subThemes')} disabled={isAiLoading} className="py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-all shadow-sm border border-slate-200 text-xs sm:text-sm bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 hover:from-amber-100 hover:to-yellow-100 active:scale-95 disabled:opacity-50">
                                        {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <Sparkles className="w-4 h-4 text-amber-500" />} ✨サブテーマ(8個)
                                    </button>
                                    <button onClick={() => handleAiAction('full')} disabled={isAiLoading} className="py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-all shadow-sm border border-slate-200 text-xs sm:text-sm bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 hover:from-violet-100 hover:to-purple-100 active:scale-95 disabled:opacity-50">
                                        {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin text-violet-600" /> : <Zap className="w-4 h-4 text-violet-500" />} 🚀全マス一括作成
                                    </button>
                                </div>
                            ) : isBlockCenterCell ? (
                                <button onClick={() => handleAiAction('block')} disabled={isAiLoading} className="w-full py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-all shadow-sm border border-slate-200 text-xs sm:text-sm bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 hover:from-amber-100 hover:to-yellow-100 active:scale-95 disabled:opacity-50">
                                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <Sparkles className="w-4 h-4 text-amber-500" />} ✨AIでこのエリアのTo-Doを埋める (8個)
                                </button>
                            ) : (
                                <button onClick={() => handleAiAction('single')} disabled={isAiLoading} className="w-full py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-all shadow-sm border border-slate-200 text-xs sm:text-sm bg-slate-50 text-slate-500 hover:bg-slate-100 active:scale-95 disabled:opacity-50">
                                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <Sparkles className="w-4 h-4 text-slate-500" />} AIでこのマスを埋める
                                </button>
                            )}
                        </div>

                        {(isMainCenter || isBlockCenterCell) && (
                            <button onClick={handleClearBlockClick} className={`w-full mt-2 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border ${isConfirmingClear ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 border-transparent hover:border-red-200'}`}>
                                {isConfirmingClear ? <AlertCircle className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                                {isConfirmingClear ? "本当に消去しますか？（もう一度タップ）" : (isMainCenter ? "全てのデータを消去" : "このエリア(9マス)を消去")}
                            </button>
                        )}

                        {isBlockCenterCell && !isMainCenter && (
                            <p className="text-[10px] text-center text-slate-400 flex justify-center items-center gap-1 mt-1">
                                <Check className="w-3 h-3" /> AIは周囲の空欄のみ埋めます
                            </p>
                        )}
                        {isMainCenter && (
                            <p className="text-[10px] text-center text-slate-400 mt-1">※「全マス一括作成」は時間がかかる場合があります</p>
                        )}
                    </div>
                </div>

                {/* 右下に追加する閉じるボタン（サイズ調整済み） */}
                <button
                    onClick={onClose}
                    className="absolute bottom-4 right-4 p-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full shadow-lg z-20 border border-slate-300"
                    title="閉じる"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// ... REST_OF_CODE_HERE_2 ...
export default function MandalaApp() {
    const [gridData, setGridData] = useState(INITIAL_DATA);
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);

    const [selectedCell, setSelectedCell] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [currentThemeId, setCurrentThemeId] = useState('blue');
    const theme = THEMES[currentThemeId];
    const [showTextModal, setShowTextModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showAdviceModal, setShowAdviceModal] = useState(false);
    const [showTitleEditModal, setShowTitleEditModal] = useState(false);

    const [appTitle, setAppTitle] = useState("チャート式マンダラグリッドAI");
    const [appSubtitle, setAppSubtitle] = useState("Target Achievement Map");

    const [adviceText, setAdviceText] = useState("");
    const [isAdviceLoading, setIsAdviceLoading] = useState(false);
    const [generatedImageData, setGeneratedImageData] = useState(null);
    const [isImageGenerating, setIsImageGenerating] = useState(false);
    const [toast, setToast] = useState({ message: null, type: 'success' });
    const [resetConfirming, setResetConfirming] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    const [activeBlock, setActiveBlock] = useState(4);
    const printRef = useRef(null);
    const editStartDataRef = useRef(null);

    const showToast = (message, type = 'success') => { setToast({ message, type }); };

    const pushHistory = (data) => {
        setHistory(prev => [...prev, data].slice(-50));
        setFuture([]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setFuture(prev => [gridData, ...prev]);
        setGridData(previous);
        setHistory(newHistory);
        showToast("元に戻しました", "success");
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const next = future[0];
        const newFuture = future.slice(1);
        setHistory(prev => [...prev, gridData]);
        setGridData(next);
        setFuture(newFuture);
        showToast("やり直しました", "success");
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) { handleRedo(); } else { handleUndo(); }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, future, gridData]);

    useEffect(() => {
        const savedData = localStorage.getItem('mandala_data_v1');
        if (savedData) { try { setGridData(JSON.parse(savedData)); } catch (e) { console.error("Failed to load data", e); } }
    }, []);
    useEffect(() => { if (gridData !== INITIAL_DATA) { localStorage.setItem('mandala_data_v1', JSON.stringify(gridData)); } }, [gridData]);

    const handleCellClick = (index) => {
        editStartDataRef.current = [...gridData];
        setSelectedCell(index);
        const blockIdx = getBlockIndex(index);
        setActiveBlock(blockIdx);
    };

    const handleCommitEdit = () => {
        const isChanged = JSON.stringify(editStartDataRef.current) !== JSON.stringify(gridData);
        if (isChanged && editStartDataRef.current) {
            pushHistory(editStartDataRef.current);
        }
    };

    const updateCell = (index, value) => {
        const newData = [...gridData];
        newData[index] = value;
        const blockIdx = getBlockIndex(index);
        const localIdx = getLocalIndex(index);
        if (blockIdx === 4 && index !== CENTER_INDEX) {
            const targetBlockIdx = CENTER_BLOCK_MAPPING[localIdx];
            newData[getGlobalIndex(targetBlockIdx, 4)] = value;
        }
        if (blockIdx !== 4 && localIdx === 4) {
            newData[getGlobalIndex(4, blockIdx)] = value;
        }
        setGridData(newData);
    };

    const handleReset = () => {
        if (!resetConfirming) { setResetConfirming(true); setTimeout(() => setResetConfirming(false), 3000); return; }
        pushHistory([...gridData]);
        setGridData(INITIAL_DATA); localStorage.removeItem('mandala_data_v1'); setResetConfirming(false); showToast("リセットしました", "success");
    };

    const handleClearBlock = () => {
        if (selectedCell === null) return;
        pushHistory([...gridData]);
        if (selectedCell === CENTER_INDEX) {
            setGridData(INITIAL_DATA);
            localStorage.removeItem('mandala_data_v1');
            showToast("全てのデータを消去しました", "success");
            setSelectedCell(null);
            return;
        }
        const blockIdx = getBlockIndex(selectedCell);
        const isBlockCenter = BLOCK_CENTERS.includes(selectedCell);
        if (isBlockCenter) {
            const newData = [...gridData];
            for (let i = 0; i < 9; i++) {
                const globalIdx = getGlobalIndex(blockIdx, i);
                newData[globalIdx] = '';
                if (blockIdx !== 4) {
                    if (i === 4) { newData[getGlobalIndex(4, blockIdx)] = ''; }
                }
            }
            setGridData(newData);
            showToast("エリアを消去しました", "success");
        }
    };

    const handleTitleSave = (newTitle, newSubtitle) => {
        setAppTitle(newTitle);
        setAppSubtitle(newSubtitle);
        showToast("タイトル設定を保存しました", "success");
    };

    const handleGenerateImage = async () => {
        if (!printRef.current || isImageGenerating) return;
        setIsImageGenerating(true);
        // 確実にレンダリングを待つ
        await new Promise(resolve => setTimeout(resolve, 100));

        // スタイルを保存（復元用）
        const originalStyle = {
            position: printRef.current.style.position,
            top: printRef.current.style.top,
            left: printRef.current.style.left,
            width: printRef.current.style.width,
            height: printRef.current.style.height,
            zIndex: printRef.current.style.zIndex,
        };

        try {
            // html2canvas用に一時的に表示（画面外ではなく最前面に配置して確実にキャプチャさせる）
            printRef.current.style.position = 'fixed';
            printRef.current.style.top = '0';
            printRef.current.style.left = '0';
            printRef.current.style.width = '1200px';
            printRef.current.style.height = 'auto'; // 高さは自動
            printRef.current.style.zIndex = '-1000'; // 背面に
            printRef.current.style.visibility = 'visible';

            const html2canvas = await loadHtml2Canvas();
            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                backgroundColor: "#ffffff",
                logging: false,
                useCORS: true,
                windowWidth: 1200,
            });

            canvas.toBlob((blob) => {
                if (!blob) {
                    showToast("画像の生成に失敗しました", "error");
                    setIsImageGenerating(false);
                    return;
                }
                const dataUrl = URL.createObjectURL(blob);
                setGeneratedImageData(dataUrl);
                setShowImageModal(true);
                setIsImageGenerating(false);
            }, 'image/png');

        } catch (error) {
            console.error("Image generation failed:", error);
            showToast("画像の生成中にエラーが発生しました", "error");
            setIsImageGenerating(false);
        } finally {
            // スタイル復元
            if (printRef.current) {
                printRef.current.style.position = originalStyle.position;
                printRef.current.style.top = originalStyle.top;
                printRef.current.style.left = originalStyle.left;
                printRef.current.style.width = originalStyle.width;
                printRef.current.style.height = originalStyle.height;
                printRef.current.style.zIndex = originalStyle.zIndex;
                printRef.current.style.visibility = 'hidden';
            }
        }
    };

    const handleImportData = (markdownText) => {
        pushHistory([...gridData]);
        const newData = parseMarkdown(markdownText);
        setGridData(newData);
        return true;
    };

    const handlePrint = () => {
        // ブラウザ標準の印刷機能を呼び出す
        window.print();
    };

    const getCellColorClass = (index) => {
        const blockIndex = getBlockIndex(index);
        if (index === CENTER_INDEX) return `${theme.center} font-bold ring-2 ${TEXT_COLOR_CLASS}`;
        if (blockIndex === 4 || getLocalIndex(index) === 4) return `${theme.sub} font-semibold ${TEXT_COLOR_CLASS} ${theme.border} border`;
        return `${theme.base} ${TEXT_COLOR_CLASS} border-slate-300 border`;
    };

    const getFontSizeClass = (text, zoomMode) => {
        const len = countVisualLength(text);
        if (zoomMode) {
            if (len === 0) return 'text-base';
            if (len <= 6) return 'text-xl sm:text-2xl';
            if (len <= 12) return 'text-base sm:text-lg';
            if (len <= 20) return 'text-sm sm:text-base';
            return 'text-xs sm:text-sm';
        } else {
            if (len === 0) return 'text-[10px]';
            if (len <= 4) return 'text-xs sm:text-sm';
            if (len <= 8) return 'text-[10px] sm:text-xs';
            if (len <= 15) return 'text-[9px] sm:text-[10px]';
            return 'text-[8px] sm:text-[9px]';
        }
    };

    const Cell = ({ index, zoomMode = false }) => {
        const bgClass = getCellColorClass(index);
        const isSelected = selectedCell === index;
        const text = gridData[index];
        const fontSizeClass = getFontSizeClass(text, zoomMode);
        return (
            <div
                onClick={() => handleCellClick(index)}
                className={`relative w-full h-full cursor-pointer transition-all duration-200 flex items-center justify-center p-0.5 ${bgClass} ${isSelected ? 'ring-2 ring-blue-500 z-10 scale-105 shadow-md' : 'hover:brightness-95'}`}
            >
                <div className="w-full h-full flex items-center justify-center text-center overflow-hidden">
                    <span className={`leading-tight break-words w-full ${fontSizeClass} font-medium`}>{text}</span>
                    {text === '' && isSelected && <span className="absolute text-slate-400 text-[10px] animate-pulse">入力</span>}
                </div>
            </div>
        );
    };

    const PrintCell = ({ index }) => {
        const bgClass = getCellColorClass(index);
        const text = gridData[index];
        let fontSize = "text-xl";
        const len = countVisualLength(text);
        if (len > 20) fontSize = "text-sm";
        else if (len > 10) fontSize = "text-lg";
        else if (len <= 6) fontSize = "text-2xl";
        return (
            <div className={`w-full h-full border border-slate-300 flex items-center justify-center p-2 ${bgClass}`}>
                <span className={`${fontSize} font-bold leading-tight text-center break-words w-full`}>{text}</span>
            </div>
        );
    };

    const handleGetAdvice = async () => {
        const mainTheme = gridData[CENTER_INDEX];
        if (!mainTheme) { showToast("まずはメインテーマを入力してください", "error"); return; }
        setShowAdviceModal(true); setIsAdviceLoading(true);
        const compactData = {
            mainTheme: mainTheme,
            subThemes: [0, 1, 2, 3, 5, 6, 7, 8].map(i => ({ theme: gridData[getGlobalIndex(4, i)], actions: [0, 1, 2, 3, 5, 6, 7, 8].map(j => gridData[getGlobalIndex(i, j)]).filter(Boolean) })).filter(obj => obj.theme)
        };
        const prompt = `あなたはプロの目標達成コーチです。以下のマンダラチャートの内容を分析し、ユーザーへのフィードバックを行ってください。
【入力データ】
${JSON.stringify(compactData)}
【依頼事項】
以下の構成で、親しみやすく、かつ洞察に富んだアドバイスを日本語で作成してください。
1. **全体的な印象**: チャートの完成度や目標のバランスについて（ポジティブに）。
2. **良い点**: 具体的に優れている点やユニークな点を1つ。
3. **改善のヒント**: より達成率を高めるための具体的なアドバイスを箇条書きで3つ。
4. **励ましのメッセージ**: 最後に一言。
※マークダウン形式で見やすく整形してください。`;
        try { const advice = await callGeminiAPI(prompt); setAdviceText(advice); } catch (e) { console.error(e); setAdviceText("申し訳ありません。現在AIアドバイス機能を利用できません。"); } finally { setIsAdviceLoading(false); }
    };

    const handleHintSuggest = async (mode = 'single', currentValue = "") => {
        if (selectedCell === null) return;
        pushHistory([...gridData]);
        let seedText = gridData[selectedCell];
        if (currentValue && currentValue.trim() !== "") { seedText = currentValue; }
        let mainTheme = gridData[CENTER_INDEX];
        if (selectedCell === CENTER_INDEX && currentValue) { mainTheme = currentValue; }
        if (selectedCell !== CENTER_INDEX && !mainTheme) { showToast("まずは中心にメインテーマを入力してください", "error"); return; }

        setIsAiLoading(true);
        const blockIdx = getBlockIndex(selectedCell);
        let prompt = "";

        if (mode === 'full') {
            prompt = `マンダラチャート（9x9の目標達成シート）を作成しています。
メインテーマ「${mainTheme}」を達成するために必要な、8つのサブテーマと、それぞれのサブテーマに対する8つの具体的な行動（ToDo）を全て生成してください。
合計72項目（サブテーマ8 + 各ToDo8x8）が必要です。
各項目は簡潔に、**20文字以内**で記述してください。
出力は以下のJSON形式のみで行ってください。
[ { "theme": "サブテーマ1", "actions": ["行動1", "行動2", ..., "行動8"] }, ... ]`;
        } else if (mode === 'subThemes') {
            prompt = `マンダラチャートのメインテーマ「${mainTheme}」を達成するために必要な、8つの具体的な要素（サブテーマ）を日本語で挙げてください。
各項目は簡潔に、**20文字以内**に収めてください。
出力はJSON配列形式（["項目1", "項目2", ...]）のみにしてください。`;
        } else if (mode === 'block') {
            let subTheme = seedText;
            if (!subTheme && blockIdx !== 4) subTheme = gridData[getGlobalIndex(blockIdx, 4)];
            const contextText = subTheme ? `サブテーマ「${subTheme}」` : `メインテーマ「${mainTheme}」に関連する要素`;
            prompt = `マンダラチャートの作成中。
${contextText}を達成するための8つの具体的な行動（ToDo）を日本語で挙げてください。
各項目は簡潔に、**20文字以内**に収めてください。
出力はJSON配列形式（["項目1", "項目2", ...]）のみにしてください。`;
        } else {
            prompt = `マンダラチャートのメインテーマ「${mainTheme}」に関連する、目標達成のための具体的な行動を1つ提案してください。
20文字以内で、JSON形式 { "suggestion": "..." } で出力してください。`;
        }

        try {
            const responseText = await callGeminiAPI(prompt);
            const jsonMatch = responseText.match(/\[[\s\S]*\]|{[:\s\S]*}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : null;
            if (!jsonStr) throw new Error("JSON not found in response");
            const parsedData = JSON.parse(jsonStr);
            const newData = [...gridData];
            if (currentValue && selectedCell !== null) { newData[selectedCell] = currentValue; }

            let filledCount = 0;
            if (mode === 'full') {
                const subBlockIndices = [0, 1, 2, 3, 5, 6, 7, 8];
                parsedData.forEach((blockData, i) => {
                    if (i >= 8) return;
                    const targetBlockIdx = subBlockIndices[i];
                    const centerSubIdx = getGlobalIndex(4, targetBlockIdx);
                    const subBlockCenterIdx = getGlobalIndex(targetBlockIdx, 4);
                    if (!newData[centerSubIdx]) newData[centerSubIdx] = blockData.theme;
                    if (!newData[subBlockCenterIdx]) newData[subBlockCenterIdx] = blockData.theme;
                    let actionCount = 0;
                    for (let j = 0; j < 9; j++) {
                        if (j === 4) continue;
                        const actionIdx = getGlobalIndex(targetBlockIdx, j);
                        if (!newData[actionIdx] && blockData.actions[actionCount]) {
                            newData[actionIdx] = blockData.actions[actionCount];
                            actionCount++;
                            filledCount++;
                        }
                    }
                });
                showToast(`一括作成完了！ ${filledCount}個の空欄を埋めました`, "success");
            } else if (mode === 'single') {
                if (!newData[selectedCell] || newData[selectedCell] === currentValue) {
                    newData[selectedCell] = parsedData.suggestion || parsedData[0];
                    filledCount = 1;
                }
                showToast("ヒントを入力しました", "success");
            } else {
                const suggestions = Array.isArray(parsedData) ? parsedData : [];
                let fillCount = 0;
                for (let i = 0; i < 9; i++) {
                    if (i === 4) continue;
                    const globalIdx = getGlobalIndex(blockIdx, i);
                    if (!newData[globalIdx]) {
                        const item = suggestions[fillCount % suggestions.length];
                        newData[globalIdx] = item;
                        if (blockIdx === 4) { newData[getGlobalIndex(i, 4)] = item; }
                        fillCount++;
                        filledCount++;
                    }
                }
                if (filledCount > 0) { showToast(`${filledCount}個の空欄を埋めました`, "success"); }
                else { showToast("空欄がなかったため変更はありません", "success"); }
            }
            setGridData(newData);
        } catch (e) {
            console.warn("AI Error:", e);
            showToast("AIエラー。もう一度お試しください。", "error");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col items-center pb-20 overflow-x-hidden w-full">
            <header className="w-full bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-20 no-print">
                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setShowTitleEditModal(true)} title="タイトルを編集">
                    <div className={`p-1.5 rounded-lg ${theme.accent}`}><Grid3x3 className="w-4 h-4 text-white" /></div>
                    <h1 className={`font-bold text-lg sm:text-xl bg-clip-text text-transparent bg-gradient-to-r ${theme.title} group-hover:opacity-80`}>{appTitle}</h1>
                    <Edit3 className="w-4 h-4 text-slate-400 opacity-100 transition-opacity" />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowTitleEditModal(true)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100"><Settings className="w-5 h-5" /></button>
                    <button onClick={handleReset} className={`p-2 rounded-full transition-all ${resetConfirming ? 'bg-red-100 text-red-600 ring-2 ring-red-400' : 'text-slate-500 hover:bg-slate-100'}`} title={resetConfirming ? "もう一度押してリセット" : "リセット"}><Trash2 className="w-5 h-5" /></button>
                </div>
            </header>

            <main className="w-full max-w-4xl p-2 sm:p-6 flex-1 flex flex-col items-center justify-start space-y-6">
                <div className="w-full max-w-[400px] flex flex-col gap-3 no-print">
                    <div className="flex bg-slate-200 p-1 rounded-lg w-full">
                        <button onClick={() => setIsZoomed(false)} className={`flex-1 py-1.5 text-sm font-bold rounded-md flex items-center justify-center gap-1 transition-all ${!isZoomed ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}><Maximize className="w-4 h-4" /> 全体</button>
                        <button onClick={() => setIsZoomed(true)} className={`flex-1 py-1.5 text-sm font-bold rounded-md flex items-center justify-center gap-1 transition-all ${isZoomed ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}><ZoomIn className="w-4 h-4" /> 拡大</button>
                    </div>

                    <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center overflow-x-auto">
                        <span className="text-xs font-bold text-slate-400 mr-2 flex-shrink-0 flex items-center gap-1"><Palette className="w-3 h-3" /> 色:</span>
                        <div className="flex gap-2">
                            {Object.values(THEMES).map((t) => (<button key={t.id} onClick={() => setCurrentThemeId(t.id)} className={`w-6 h-6 rounded-full ${t.color} border-2 transition-transform flex-shrink-0 ${currentThemeId === t.id ? 'border-slate-800 scale-125' : 'border-slate-200 hover:border-slate-300 hover:scale-110 shadow-sm'}`} title={t.name} />))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleGetAdvice} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"><Sparkles className="w-4 h-4 text-yellow-300" /> ✨AIアドバイスをもらう</button>
                    </div>

                    <div className="flex gap-2 w-full">
                        <button onClick={handleUndo} disabled={history.length === 0} className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all" title="元に戻す (Ctrl+Z)">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                        <button onClick={handleRedo} disabled={future.length === 0} className="p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all" title="やり直す (Ctrl+Shift+Z)">
                            <RotateCw className="w-5 h-5" />
                        </button>
                        <button onClick={() => setShowImportModal(true)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-slate-200 transition-all"><Import className="w-4 h-4" />データ取り込む</button>
                    </div>
                </div>

                {showWelcome && (
                    <div className="w-full max-w-[600px] mb-2 bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex items-start gap-3 relative animate-fadeIn no-print">
                        <div className={`p-2 rounded-full text-white ${theme.accent}`}><Lightbulb className="w-5 h-5" /></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800">AI機能で思考を加速！</h3>
                            <p className="text-sm text-slate-600 mt-1">AI機能でテーマ拡張・マス埋めが超簡単に！作成後は専属コーチからのAIアドバイスも受け取れます。思考整理を加速させましょう。</p>
                        </div>
                        <button onClick={() => setShowWelcome(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
                    </div>
                )}

                <div className="w-full flex justify-center items-start no-print">
                    {isZoomed ? (
                        <div className={`w-full max-w-[400px] aspect-square bg-white rounded-xl shadow-xl border-4 overflow-hidden animate-fadeIn ${theme.id === 'white' ? 'border-slate-800' : `border-${theme.id}-500/50`}`}>
                            <div className={`p-2 text-center text-xs font-bold border-b flex justify-between items-center ${theme.id === 'white' ? 'bg-slate-100 text-slate-800 border-slate-300' : `${theme.sub.split(' ')[0]} border-${theme.id}-100 text-slate-800`}`}>
                                <button onClick={() => setActiveBlock(prev => Math.max(0, prev - 1))} disabled={activeBlock === 0} className="p-1 disabled:opacity-30">◀</button>
                                <span>{activeBlock === 4 ? "中心テーマ (Main)" : `サブエリア ${activeBlock < 4 ? activeBlock + 1 : activeBlock} / 8`}</span>
                                <button onClick={() => setActiveBlock(prev => Math.min(8, prev + 1))} disabled={activeBlock === 8} className="p-1 disabled:opacity-30">▶</button>
                            </div>
                            <div className="grid grid-cols-3 grid-rows-3 gap-1 bg-slate-300 p-1 h-[calc(100%-32px)]">{[...Array(9)].map((_, i) => { const globalIndex = getGlobalIndex(activeBlock, i); return <Cell key={globalIndex} index={globalIndex} zoomMode={true} />; })}</div>
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto pb-4 px-2 snap-x">
                            <div className="min-w-[600px] aspect-square bg-white rounded-xl shadow-xl border-4 border-slate-800 overflow-hidden mx-auto">
                                <div className="grid grid-cols-3 grid-rows-3 gap-1 bg-slate-800 p-1 h-full">{[...Array(9)].map((_, blockIndex) => (<div key={blockIndex} className="grid grid-cols-3 grid-rows-3 gap-px bg-slate-300 h-full">{[...Array(9)].map((_, cellIndex) => { const globalIndex = getGlobalIndex(blockIndex, cellIndex); return <Cell key={globalIndex} index={globalIndex} zoomMode={false} />; })}</div>))}</div>
                            </div>
                            <p className="text-center text-xs text-slate-400 mt-2">※横にスクロールして全体を確認できます</p>
                        </div>
                    )}
                </div>

                <div className="w-full max-w-sm flex flex-col gap-3 no-print">
                    <button onClick={handleGenerateImage} disabled={isImageGenerating} className={`w-full py-4 text-white rounded-2xl shadow-lg font-bold text-lg flex items-center justify-center gap-3 transition-transform active:scale-95 ${theme.accent} ${theme.accentHover} ${isImageGenerating ? 'opacity-80 cursor-not-allowed' : ''}`}>{isImageGenerating ? <><Loader2 className="w-6 h-6 animate-spin" /> 作成中...</> : <><Download className="w-6 h-6" /> 画像を保存する</>}</button>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handlePrint} className="py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"><Printer className="w-5 h-5" />印刷</button>
                        <button onClick={() => setShowTextModal(true)} className="py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"><FileText className="w-5 h-5" />テキスト出力</button>
                    </div>
                </div>

                <div className="text-center text-slate-400 text-xs py-4 mt-8 font-mono no-print">Copyright &copy; 株式会社AI顧問ワークス feat. 生成AI共創道場 2025-2026</div>

            </main>

            {/* 画像保存用 (修正: fixed + visibility制御) */}
            <div
                ref={printRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '1200px',
                    height: '1350px',
                    zIndex: -50,
                    opacity: 0,
                    visibility: 'hidden',
                    pointerEvents: 'none'
                }}
            >
                <div className="w-full h-full bg-white p-12 flex flex-col items-center justify-center">
                    <div className="text-center mb-8"><h1 className="text-4xl font-bold text-slate-800 mb-2">{appTitle}</h1><p className="text-xl text-slate-500">{appSubtitle}</p></div>
                    <div className="w-[1080px] h-[1080px] bg-slate-800 p-2 border-8 border-slate-800 rounded-none">
                        <div className="grid grid-cols-3 grid-rows-3 gap-2 bg-slate-800 w-full h-full">{[...Array(9)].map((_, blockIndex) => (<div key={blockIndex} className="grid grid-cols-3 grid-rows-3 gap-1 bg-slate-300 h-full">{[...Array(9)].map((_, cellIndex) => { const globalIndex = getGlobalIndex(blockIndex, cellIndex); return <PrintCell key={globalIndex} index={globalIndex} />; })}</div>))}</div>
                    </div>
                    <div className="mt-8 text-slate-400 text-lg">Created with 株式会社AI顧問ワークス feat. 生成AI共創道場</div>
                </div>
            </div>

            <EditModal isOpen={selectedCell !== null} onClose={() => setSelectedCell(null)} value={selectedCell !== null ? gridData[selectedCell] : ''} onChange={(val) => updateCell(selectedCell, val)} cellIndex={selectedCell} onHintSuggest={handleHintSuggest} isAiLoading={isAiLoading} theme={theme} showToast={showToast} onClearBlock={handleClearBlock} onCommitEdit={handleCommitEdit} />
            <TextExportModal isOpen={showTextModal} onClose={() => setShowTextModal(false)} data={gridData} showToast={showToast} />
            <ImagePreviewModal isOpen={showImageModal} onClose={() => setShowImageModal(false)} imageData={generatedImageData} />
            <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleImportData} showToast={showToast} />
            <AdviceModal isOpen={showAdviceModal} onClose={() => setShowAdviceModal(false)} adviceText={adviceText} isLoading={isAdviceLoading} />
            <TitleEditModal isOpen={showTitleEditModal} onClose={() => setShowTitleEditModal(false)} title={appTitle} subtitle={appSubtitle} onSave={handleTitleSave} />
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: null, type: 'success' })} />

            <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        @media print { .no-print { display: none !important; } body { background: white; } @page { margin: 0; size: auto; } }
      `}</style>
        </div>
    );
}
