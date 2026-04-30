/**
 * AI 灵感创作工坊 V6 (Alpine.js 响应式重构 + 性能优化版) - Cloudflare Worker
 * 包含：弹簧动画、虚拟列表渲染、任务持久化与重试、多级触感反馈、本地数据库
 */

const API_BASE = "https://pucoding.com";
const API_KEYS =[
    "sk-eae8e4ee6c612e45dba945ee66c347ee955b4f4b9d85baf0d945313f9291fc2e"
];
const MODEL_NAME = "gpt-image-2";

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="zh-CN" :class="{ 'dark': theme === 'dark' }" x-data="appData()">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title x-text="modelName + ' (听风提供)'">gpt-image-2 (听风提供)</title>
    <!-- Tailwind CSS (生产环境建议本地安装) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script>
        // 抑制 Chrome Built-In AI 警告（如果存在）
        if (typeof window !== 'undefined') {
            const originalConsoleWarn = console.warn;
            console.warn = function(...args) {
                // 过滤掉 Chrome Built-In AI 相关的警告
                if (args[0] && typeof args[0] === 'string' && 
                    (args[0].includes('Built-In AI') || args[0].includes('LanguageDetector'))) {
                    return; // 不输出此警告
                }
                originalConsoleWarn.apply(console, args);
            };
        }
        
        tailwind.config = {
            darkMode: 'class',
            theme: { extend: { colors: { primary: '#3b82f6' } } }
        }
    </script>
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; }
        
        [x-cloak] { display: none !important; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.6); }

        /* 弹簧动画引擎 (Spring Animation) */
        :root {
            --spring-easing: linear(
                0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017,
                1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%,
                1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%,
                0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1
            );
        }
        .spring-anim { transition: all 0.6s var(--spring-easing); }
        .spring-transform { transition: transform 0.6s var(--spring-easing); }

        /* 虚拟列表渲染优化 (极大提升 1000+ 图片时的 DOM 性能) */
        .gallery-item {
            content-visibility: auto;
            contain-intrinsic-size: 260px;
            will-change: transform, opacity;
        }

        /* 玻璃拟态面板 */
        .glass-panel { 
            background: rgba(255, 255, 255, 0.65); 
            backdrop-filter: blur(20px) saturate(150%); 
            -webkit-backdrop-filter: blur(20px) saturate(150%);
            border: 1px solid rgba(255,255,255,0.7); 
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255,255,255,0.6);
            position: relative; overflow: hidden;
        }
        .dark .glass-panel { 
            background: rgba(15, 23, 42, 0.65); 
            border: 1px solid rgba(255,255,255,0.1); 
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .select-card { cursor: pointer; transition: all 0.4s var(--spring-easing); border: 2px solid transparent; }
        .select-card:active { transform: scale(0.92); }
        .select-card.active { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white !important; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        .select-card.active span, .select-card.active div { color: white !important; border-color: white !important; }
        
        .progress-bar-stripes { background-image: linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent); background-size: 1rem 1rem; animation: progress-animation 1s linear infinite; }
        @keyframes progress-animation { from { background-position: 1rem 0; } to { background-position: 0 0; } }
        
        .skeleton-loader { background: linear-gradient(90deg, rgba(200,200,200,0.1) 25%, rgba(200,200,200,0.3) 50%, rgba(200,200,200,0.1) 75%); background-size: 400% 100%; animation: skeleton 2s infinite linear; }
        @keyframes skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .ripple-btn { position: relative; overflow: hidden; }
        .ripple-effect { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%); transform: scale(0); animation: ripple 0.8s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; }
        @keyframes ripple { 0% { transform: scale(0); opacity: 0.5; } 100% { transform: scale(4); opacity: 0; } }

        @media (max-width: 1024px) { main { padding-bottom: 80px; } }
        
        /* 超小屏幕优化 (320px - 480px) */
        @media (max-width: 480px) {
            .glass-panel { padding: 0.5rem !important; }
            .select-card { padding: 0.5rem !important; }
            .gallery-item { height: 180px !important; }
            .gallery-item img { height: 100px !important; }
            h1 { font-size: 1rem !important; }
            h2 { font-size: 0.875rem !important; }
            textarea { font-size: 0.75rem !important; min-height: 80px !important; }
            button { font-size: 0.75rem !important; padding: 0.5rem !important; }
            .grid-cols-6 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            .grid-cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        
        /* 极小屏幕优化 (< 400px) */
        @media (max-width: 400px) {
            body { font-size: 12px; }
            .container { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
            .gallery-item { height: 160px !important; }
            .gallery-item img { height: 90px !important; }
            .text-xs { font-size: 0.65rem !important; }
            .text-sm { font-size: 0.75rem !important; }
            header { padding: 0.5rem !important; }
        }
        
        /* 超矮+超窄屏幕组合优化 */
        @media (max-height: 500px) and (max-width: 600px) {
            main {
                padding-top: 0.5rem !important;
                padding-bottom: 0.5rem !important;
            }
            .glass-panel {
                padding: 0.5rem !important;
                margin-bottom: 0.5rem !important;
            }
            h1 {
                font-size: 0.75rem !important;
            }
            textarea {
                min-height: 50px !important;
                font-size: 0.7rem !important;
            }
            button {
                padding: 0.375rem !important;
                font-size: 0.7rem !important;
            }
            .grid-cols-2 {
                gap: 0.25rem !important;
            }
            nav.fixed.bottom-0 {
                padding-top: 0.25rem !important;
                padding-bottom: 0.25rem !important;
            }
        }
        
        /* 自定义 xs 断点 (480px) */
        @media (min-width: 480px) {
            .xs\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        
        /* 自动分辨率适配 - 确保任何屏幕都能完整显示 */
        @media (max-height: 600px) {
            /* 超矮屏幕优化 */
            main { min-height: auto !important; }
            .glass-panel { max-height: calc(100vh - 80px); overflow-y: auto; }
            textarea { min-height: 60px !important; rows: 3 !important; }
            .gallery-item { height: 150px !important; }
            .gallery-item img { height: 80px !important; }
        }
        
        @media (max-width: 360px) {
            /* 超窄屏幕优化 */
            body { font-size: 11px; }
            h1 { font-size: 0.875rem !important; }
            .container { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
            .grid-cols-2 { gap: 0.25rem !important; }
            button { padding: 0.375rem 0.5rem !important; font-size: 0.7rem !important; }
        }
        
        /* 确保内容不溢出视口 */
        html, body {
            max-width: 100vw;
            overflow-x: hidden;
        }
        
        /* 防止横向滚动 */
        * {
            box-sizing: border-box;
        }
        
        /* 确保图片不会溢出容器 */
        img {
            max-width: 100%;
            height: auto;
        }
        
        /* 侧边栏滚动优化 */
        .glass-panel .overflow-y-auto {
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
        }
        
        .glass-panel .overflow-y-auto::-webkit-scrollbar {
            width: 4px;
        }
        
        .glass-panel .overflow-y-auto::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .glass-panel .overflow-y-auto::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.4);
            border-radius: 10px;
        }
        
        .glass-panel .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: rgba(148, 163, 184, 0.6);
        }
        
        /* 确保各滚动区域独立 */
        main > div {
            contain: layout style paint;
        }
        
        /* 低分辨率完整滚动支持 */
        @media (max-height: 700px) {
            body {
                overflow-y: auto !important;
                height: auto !important;
            }
            main {
                height: auto !important;
                min-height: calc(100vh - 60px) !important;
                overflow-y: visible !important;
            }
            .glass-panel {
                max-height: none !important;
            }
            /* 画廊容器高度调整 */
            [x-ref="galleryContainer"] {
                max-height: calc(100vh - 250px) !important;
            }
        }
        
        /* 超矮屏幕优化 (< 600px) */
        @media (max-height: 600px) {
            header {
                padding: 0.25rem 0.5rem !important;
            }
            h1 {
                font-size: 0.875rem !important;
            }
            textarea {
                min-height: 60px !important;
                rows: 2 !important;
            }
            .select-card {
                padding: 0.375rem !important;
            }
            button {
                padding: 0.5rem !important;
                font-size: 0.75rem !important;
            }
            /* 侧边栏高度调整 */
            .fixed.inset-y-0.left-0 {
                max-height: calc(100vh - 50px) !important;
                top: 50px !important;
            }
            /* 移动端底部导航 */
            nav.fixed.bottom-0 {
                padding-bottom: env(safe-area-inset-bottom, 0) !important;
            }
        }
    </style>
</head>
<body class="min-h-screen flex flex-col bg-slate-50 text-slate-800 dark:bg-[#0f172a] dark:text-[#e2e8f0] transition-colors duration-300">

    <!-- Toasts -->
    <div class="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
        <template x-for="toast in toasts" :key="toast.id">
            <div x-show="toast.visible" x-transition:enter="spring-anim transform" x-transition:enter-start="translate-x-full opacity-0" x-transition:enter-end="translate-x-0 opacity-100" x-transition:leave="transition ease-in duration-200 transform" x-transition:leave-start="translate-x-0 opacity-100" x-transition:leave-end="translate-x-full opacity-0"
                 :class="{'border-emerald-500': toast.type==='success', 'border-red-500': toast.type==='error', 'border-blue-500': toast.type==='info', 'border-amber-500': toast.type==='warning'}"
                 class="bg-white dark:bg-slate-800 border-l-4 shadow-xl rounded-r-lg px-4 py-3 flex items-center gap-3 w-72 pointer-events-auto">
                <i class="fas text-lg" :class="{'fa-check-circle text-emerald-500': toast.type==='success', 'fa-exclamation-circle text-red-500': toast.type==='error', 'fa-info-circle text-blue-500': toast.type==='info', 'fa-exclamation-triangle text-amber-500': toast.type==='warning'}"></i>
                <p class="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1" x-text="toast.msg"></p>
            </div>
        </template>
    </div>

    <!-- Modal -->
    <div x-show="modal.open" x-cloak class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div @click.away="modal.open = false" x-show="modal.open" x-transition:enter="spring-anim" x-transition:enter-start="opacity-0 scale-90" x-transition:enter-end="opacity-100 scale-100" x-transition:leave="transition ease-in duration-150" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95"
             class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 class="text-lg font-bold mb-2 text-slate-800 dark:text-white" x-text="modal.title"></h3>
            <p class="text-sm text-slate-600 dark:text-slate-300 mb-6" x-text="modal.desc"></p>
            <div class="flex gap-3 justify-end">
                <button @click="haptic('light'); modal.open = false" class="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-sm font-medium spring-anim active:scale-95">取消</button>
                <button @click="haptic('medium'); modal.onConfirm(); modal.open = false" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium spring-anim active:scale-95 shadow-lg">确定</button>
            </div>
        </div>
    </div>

    <!-- API Info Modal -->
    <div x-show="apiInfo.open" x-cloak class="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div @click.away="apiInfo.open = false" x-show="apiInfo.open" 
             x-transition:enter="spring-anim" x-transition:enter-start="opacity-0 scale-90" x-transition:enter-end="opacity-100 scale-100" 
             x-transition:leave="transition ease-in duration-150" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95"
             class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                    <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                    API 配置信息
                </h3>
                <button @click="apiInfo.open = false" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 spring-anim active:scale-90">
                    <i class="fas fa-times text-slate-500"></i>
                </button>
            </div>

            <div class="space-y-4">
                <!-- API 配置卡片 -->
                <div class="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-key text-blue-500 mr-2"></i>
                        <span class="font-bold text-slate-800 dark:text-white">本站 API 配置</span>
                        <span class="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">限时免费</span>
                    </div>
                    
                    <div class="space-y-2 text-sm">
                        <div>
                            <span class="text-slate-600 dark:text-slate-400 font-medium">API Base:</span>
                            <code class="ml-2 bg-white dark:bg-slate-900 px-2 py-1 rounded text-xs font-mono text-blue-600 dark:text-blue-400 break-all">${API_BASE}</code>
                        </div>
                        <div>
                            <span class="text-slate-600 dark:text-slate-400 font-medium">Model:</span>
                            <code class="ml-2 bg-white dark:bg-slate-900 px-2 py-1 rounded text-xs font-mono text-purple-600 dark:text-purple-400">${MODEL_NAME}</code>
                        </div>
                        <div>
                            <span class="text-slate-600 dark:text-slate-400 font-medium">API Key:</span>
                            <div class="flex items-center gap-2 mt-1">
                                <code class="flex-1 bg-white dark:bg-slate-900 px-2 py-1 rounded text-xs font-mono text-slate-700 dark:text-slate-300 break-all" x-text="apiInfo.apiKey"></code>
                                <button @click="copyApiKey()" class="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs spring-anim active:scale-95 whitespace-nowrap">
                                    <i class="fas fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                        <p class="text-xs text-slate-600 dark:text-slate-400">
                            <i class="fas fa-clock text-amber-500 mr-1"></i>
                            <span class="font-medium">⚠️ 此 API Key 为限时一个月无限请求权限</span>
                        </p>
                        <p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
                            完整路径示例：<code class="text-xs">${API_BASE}/v1/images/generations</code>
                        </p>
                    </div>
                </div>

                <!-- 使用限制说明 -->
                <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                    <div class="flex items-start">
                        <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5 mr-2"></i>
                        <div class="flex-1">
                            <h4 class="font-bold text-amber-800 dark:text-amber-400 mb-2">使用限制说明</h4>
                            <ul class="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                                <li>本站提供免费套餐：<strong>每天 10 万次请求</strong></li>
                                <li>超出限额后将无法继续使用</li>
                                <li>建议开发者自行配置 API Key 以保证稳定性</li>
                                <li>请勿滥用，合理使用资源</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- 开源信息 -->
                <div class="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center mb-3">
                        <svg class="w-5 h-5 text-slate-700 dark:text-slate-300 mr-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span class="font-bold text-slate-800 dark:text-white">开源项目</span>
                    </div>
                    <p class="text-xs text-slate-600 dark:text-slate-400 mb-2">
                        本站源码完全开源，欢迎 Star 和贡献代码！
                    </p>
                    <a href="https://github.com/lza6/AI-Image-Generation-cfwork" target="_blank" 
                       class="inline-flex items-center px-3 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg text-xs spring-anim active:scale-95 transition-colors">
                        <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        GitHub 仓库
                        <i class="fas fa-external-link-alt ml-2 text-xs"></i>
                    </a>
                </div>

                <!-- 联系方式 -->
                <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                    <div class="flex items-center mb-2">
                        <i class="fab fa-weixin text-emerald-500 mr-2 text-lg"></i>
                        <span class="font-bold text-emerald-800 dark:text-emerald-400">联系维护者</span>
                    </div>
                    <p class="text-xs text-emerald-700 dark:text-emerald-300 mb-2">
                        如有问题或合作意向，欢迎联系网站维护者
                    </p>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-emerald-600 dark:text-emerald-400 font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded">微信: Tf00798</span>
                        <button @click="copyWechat()" class="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs spring-anim active:scale-95">
                            <i class="fas fa-copy mr-1"></i>复制
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Lightbox -->
    <div x-show="lb.open" x-cloak class="fixed inset-0 z-[9998] bg-black/95 flex flex-col items-center justify-center backdrop-blur-md transition-opacity">
        <div class="absolute top-4 right-4 flex gap-3 z-50">
            <button @click="haptic('light'); lbDownload()" class="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full text-white flex items-center justify-center backdrop-blur spring-anim active:scale-90"><i class="fas fa-download"></i></button>
            <button @click="haptic('light'); lb.open = false" class="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full text-white flex items-center justify-center backdrop-blur spring-anim active:scale-90"><i class="fas fa-times text-xl"></i></button>
        </div>
        <div class="absolute bottom-6 flex gap-4 z-50 bg-black/50 px-6 py-3 rounded-full backdrop-blur border border-white/10">
            <button @click="haptic('light'); lb.scale = Math.max(lb.scale - 0.25, 0.5)" class="text-white hover:text-blue-400 transition text-lg"><i class="fas fa-search-minus"></i></button>
            <span class="text-white text-sm font-mono flex items-center w-12 justify-center" x-text="Math.round(lb.scale * 100) + '%'"></span>
            <button @click="haptic('light'); lb.scale = Math.min(lb.scale + 0.25, 3)" class="text-white hover:text-blue-400 transition text-lg"><i class="fas fa-search-plus"></i></button>
            <div class="w-px h-5 bg-white/30 mx-2 self-center"></div>
            <button @click="haptic('medium'); lbContinue()" class="text-blue-400 hover:text-blue-300 transition text-sm font-medium flex items-center"><i class="fas fa-magic mr-1"></i>基于此图创作</button>
        </div>
        <div class="w-full h-full overflow-hidden flex items-center justify-center relative" @wheel.prevent="lbWheel($event)" @click.self="lb.open = false">
            <img :src="lb.item?.base64" :style="\`transform: translate(\${lb.x}px, \${lb.y}px) scale(\${lb.scale})\`" 
                 @mousedown="lbDragStart" @mousemove="lbDragMove" @mouseup="lbDragEnd" @mouseleave="lbDragEnd"
                 class="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing pointer-events-auto" draggable="false">
        </div>
    </div>

    <!-- Lab Preview -->
    <div x-show="labPreview.open" x-cloak class="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div @click.away="labPreview.open = false" x-show="labPreview.open"
             x-transition:enter="spring-anim" x-transition:enter-start="opacity-0 translate-y-8 scale-95" x-transition:enter-end="opacity-100 translate-y-0 scale-100"
             x-transition:leave="transition ease-in duration-200" x-transition:leave-start="opacity-100 translate-y-0 scale-100" x-transition:leave-end="opacity-0 translate-y-8 scale-95"
             class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh] shadow-2xl border border-slate-200 dark:border-slate-700">
            
            <div class="relative w-full h-64 sm:h-80 bg-slate-100 dark:bg-slate-800 flex-shrink-0 group skeleton-loader">
                <img :src="labPreview.item ? labPreview.item.img : ''" class="w-full h-full object-contain relative z-10" onload="this.parentElement.classList.remove('skeleton-loader')" @error="handleImgError($event, labPreview.item?.path)">
                <button @click="labPreview.open = false" class="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur spring-anim active:scale-90 z-20"><i class="fas fa-times"></i></button>
            </div>
            
            <div class="p-5 overflow-y-auto flex-grow relative">
                <h3 class="text-xl font-extrabold text-slate-800 dark:text-white mb-3" x-text="labPreview.item ? labPreview.item.title : ''"></h3>
                <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
                    <p class="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed" x-text="labPreview.item ? labPreview.item.prompt : ''"></p>
                </div>
            </div>
            
            <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <button @click="useLabPrompt($event)" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 spring-anim active:scale-95 flex items-center justify-center text-base ripple-btn">
                    <i class="fas fa-magic mr-2"></i> 一键使用此灵感
                </button>
            </div>
        </div>
    </div>

    <!-- Header -->
    <header class="glass-panel sticky top-0 z-40 px-3 md:px-4 py-2 md:py-3 flex justify-between items-center shadow-sm dark:shadow-lg lg:border-b-0 border-b border-slate-200 dark:border-slate-800">
        <div class="flex items-center space-x-2 md:space-x-3">
            <!-- 移动端灵感库汉堡菜单按钮 -->
            <button @click="haptic('light'); isLabOpen = !isLabOpen" 
                    class="lg:hidden w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 spring-anim active:scale-90 text-slate-600 dark:text-slate-300">
                <i class="fas fa-bars text-sm md:text-base"></i>
            </button>
            
            <div class="bg-gradient-to-tr from-blue-500 to-purple-500 p-1.5 md:p-2 rounded-xl shadow-md">
                <i class="fas fa-cube text-white text-base md:text-lg"></i>
            </div>
            <h1 class="text-sm md:text-lg lg:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 truncate max-w-[150px] md:max-w-none" x-text="modelName + ' (听风提供)'"></h1>
        </div>
        <div class="flex items-center space-x-2 md:space-x-3">
            <button @click="haptic('light'); theme = theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('ai_theme', theme)" class="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 spring-anim active:scale-90 text-slate-600 dark:text-slate-300">
                <i class="fas fa-moon text-sm md:text-base" x-show="theme === 'light'"></i>
                <i class="fas fa-sun text-sm md:text-base" x-show="theme === 'dark'" x-cloak></i>
            </button>
            <button @click="haptic('light'); apiInfo.open = true" class="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 spring-anim active:scale-90 text-blue-600 dark:text-blue-400 relative">
                <i class="fas fa-exclamation-circle text-sm md:text-base"></i>
                <span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </button>
        </div>
    </header>

    <main class="flex-grow container mx-auto px-2 md:px-4 py-4 flex flex-col lg:flex-row gap-5 relative lg:pl-[420px]">
        
        <!-- Lab Sidebar Toggle (Desktop Only - Hidden because sidebar is always visible on desktop) -->

        <!-- Lab Sidebar (Mobile Drawer + Desktop Sidebar) -->
        <div :class="isLabOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'" 
             class="fixed inset-y-0 left-0 z-50 w-[85vw] sm:w-80 lg:w-[400px] max-w-[360px] lg:max-w-none flex-shrink-0 spring-transform ease-out">
            <div class="h-full glass-panel lg:rounded-2xl shadow-2xl lg:shadow-lg border-r lg:border border-white/40 dark:border-slate-700/50 flex flex-col bg-white/80 dark:bg-slate-900/80 overflow-hidden">
                
                <div class="p-3 md:p-4 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center bg-white/50 dark:bg-slate-800/50 rounded-t-2xl backdrop-blur-md">
                    <h2 class="font-bold text-slate-800 dark:text-white flex items-center text-base md:text-lg">
                        <i class="fas fa-flask text-purple-500 mr-2"></i>灵感图库 
                        <span class="ml-2 text-[9px] md:text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">全球加速</span>
                    </h2>
                    <button @click="haptic('light'); isLabOpen = false" class="lg:hidden text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 spring-anim active:scale-90">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-3 space-y-4 md:space-y-6 scroll-smooth" style="-webkit-overflow-scrolling: touch;">
                    <template x-for="(cat, idx) in promptLibrary" :key="'cat_'+idx">
                        <div>
                            <div class="flex items-center gap-2 mb-2 md:mb-3 pl-1 sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl z-10 py-1 md:py-1.5 rounded-lg">
                                <span class="w-1 h-3 md:h-4 rounded-full bg-gradient-to-b from-blue-500 to-purple-500"></span>
                                <h3 class="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 tracking-wide" x-text="cat?.category || '未分类'"></h3>
                            </div>
                            <div class="grid grid-cols-2 gap-2 md:gap-2.5">
                                <template x-for="(item, i) in cat?.items ||[]" :key="'item_'+idx+'_'+i">
                                    <div @click="haptic('light'); openLabPreview(item)" 
                                         class="group relative rounded-lg md:rounded-xl overflow-hidden cursor-pointer bg-slate-200 dark:bg-slate-800 aspect-square shadow-sm border border-slate-200/50 dark:border-slate-700/50 skeleton-loader spring-anim active:scale-95">
                                        <img :src="item?.img" loading="lazy" onload="this.parentElement.classList.remove('skeleton-loader')" @error="handleImgError($event, item.path)"
                                             class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-1.5 md:p-2">
                                            <p class="text-white text-[9px] md:text-xs font-bold line-clamp-2 leading-tight drop-shadow-md" x-text="item?.title"></p>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
        
        <!-- 移动端背景点击区域（用于关闭侧边栏） -->
        <div x-show="isLabOpen" @click="isLabOpen = false" x-cloak
             class="lg:hidden fixed inset-0 z-40"></div>

        <!-- Create Panel -->
        <div class="w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 flex flex-col gap-3 md:gap-4 spring-anim max-h-none lg:max-h-[calc(100vh-120px)]" :class="{'hidden lg:flex': currentTab !== 'create'}">
            <div class="glass-panel rounded-2xl p-3 md:p-5 shadow-lg flex flex-col border border-slate-200 dark:border-slate-700/50 relative overflow-hidden">
                <div class="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>
                
                <div class="mb-5 relative z-10 flex justify-between items-center">
                    <label class="block text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center">
                        <i class="fas fa-terminal text-blue-500 mr-2 text-xs"></i>画面描述 (Prompt)
                    </label>
                    <button @click="haptic('light'); isLabOpen = true" class="lg:hidden text-[10px] bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-1 rounded border border-purple-200 dark:border-purple-800/50 flex items-center gap-1 shadow-sm spring-anim active:scale-95">
                        <i class="fas fa-flask"></i> 灵感图库
                    </button>
                </div>
                
                <div class="mb-3 md:mb-5 relative z-10">
                    <textarea x-model="prompt" rows="4" class="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 md:p-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition resize-none placeholder-slate-400 dark:placeholder-slate-600 shadow-inner text-xs md:text-sm" placeholder="描述你的灵感..."></textarea>
                </div>

                <div class="mb-3 md:mb-5 relative z-10">
                    <label class="block text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5 md:mb-2 flex items-baseline justify-between">
                        <div class="flex items-center"><i class="fas fa-crop-alt text-purple-500 mr-2 text-[10px] md:text-xs"></i>画幅比例</div>
                    </label>
                    <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5 md:gap-2">
                        <template x-for="r in ratioOptions" :key="r.val">
                            <div @click="haptic('light'); ratio = r.val; localStorage.setItem('ai_pref_ratio', ratio)" 
                                 :class="{'active': ratio === r.val}" 
                                 class="select-card bg-slate-100 dark:bg-slate-800 rounded-xl p-2 text-center flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700">
                                <div class="border-[2px] border-slate-400 dark:border-slate-500 mb-1.5 rounded-sm transition-colors" :class="r.iconClass"></div>
                                <span class="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 font-medium transition-colors" x-text="r.label"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <div class="mb-3 md:mb-5 relative z-10">
                    <label class="block text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5 md:mb-2 flex items-center">
                        <i class="fas fa-layer-group text-emerald-500 mr-2 text-[10px] md:text-xs"></i>单次生成数量
                    </label>
                    <div class="flex gap-1.5 md:gap-2">
                        <template x-for="n in [1,2,3,4]" :key="n">
                            <div @click="haptic('light'); count = n; localStorage.setItem('ai_pref_count', count)" 
                                 :class="{'active': count === n}" 
                                 class="select-card flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg md:rounded-xl py-1.5 md:py-2 text-center border border-slate-200 dark:border-slate-700 font-bold text-xs md:text-sm text-slate-700 dark:text-slate-300" x-text="n"></div>
                        </template>
                    </div>
                </div>

                <div class="mb-auto relative z-10">
                    <label class="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex justify-between items-end">
                        <span class="flex items-center"><i class="fas fa-images text-pink-500 mr-2 text-xs"></i>参考图队列区</span>
                        <span class="text-[10px] text-slate-500 font-normal">可选·最多4张</span>
                    </label>
                    <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl p-3">
                        <div x-show="refFiles.length > 0" class="grid grid-cols-4 gap-2 mb-2">
                            <template x-for="(f, index) in refFiles" :key="index">
                                <div class="relative w-full aspect-square rounded-lg overflow-hidden border border-slate-300 group bg-slate-200">
                                    <img :src="f.url" class="w-full h-full object-cover">
                                    <button @click.stop="haptic('medium'); removeRef(index)" class="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 rounded-full flex items-center justify-center text-white backdrop-blur shadow spring-anim active:scale-90"><i class="fas fa-times text-[10px]"></i></button>
                                </div>
                            </template>
                        </div>
                        <div @click="haptic('light'); $refs.fileInput.click()" @dragover.prevent="$el.classList.add('border-blue-500')" @dragleave.prevent="$el.classList.remove('border-blue-500')" @drop.prevent="$el.classList.remove('border-blue-500'); handleDrop($event)"
                             class="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center transition cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800">
                            <i class="fas fa-cloud-upload-alt text-2xl text-slate-400 mb-2"></i>
                            <p class="text-xs text-slate-600 dark:text-slate-300 font-medium">点击添加 或 <span class="bg-slate-200 dark:bg-slate-700 px-1 rounded text-[10px]">Ctrl+V</span></p>
                            <input type="file" x-ref="fileInput" @change="handleFileSelect($event)" class="hidden" multiple accept="image/*">
                        </div>
                    </div>
                </div>

                <div class="mt-6 relative z-10">
                    <button @click="haptic('heavy'); generateTasks()" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-xl shadow-blue-500/25 spring-anim active:scale-95 flex items-center justify-center text-base ripple-btn">
                        <i class="fas fa-paper-plane mr-2"></i> <span>提交任务队列</span>
                    </button>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-3 text-center">
                        <i class="fas fa-bolt text-yellow-500 mr-1"></i>响应式后台处理引擎，状态自动同步。
                    </p>
                </div>
            </div>
        </div>

        <!-- Gallery Panel -->
        <div class="w-full lg:flex-1 flex flex-col min-w-0 spring-anim" :class="{'hidden lg:flex': currentTab !== 'gallery'}">
            
            <div class="mb-2 md:mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-2 md:p-2.5 flex items-start gap-2 shadow-sm animate-pulse-fast">
                <i class="fas fa-shield-alt text-red-500 mt-0.5 text-xs md:text-sm"></i>
                <p class="text-[10px] md:text-xs text-red-600 dark:text-red-400 font-bold leading-tight">
                    本站不提供保存用户的记录数据行为，缓存仅存在您当前浏览器本地。如遇到喜欢的图片请自行下载完毕！清理浏览器缓存或重装系统将导致图片永久丢失。
                </p>
            </div>

            <div class="glass-panel rounded-2xl flex flex-col shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 flex-grow">
                <div class="bg-white/50 dark:bg-slate-800/80 px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200 dark:border-slate-700/50 z-10">
                    <div class="flex items-center space-x-3 w-full md:w-auto">
                        <h2 class="text-base font-bold text-slate-800 dark:text-white"><i class="fas fa-layer-group text-blue-500 mr-2"></i>任务与画廊</h2>
                        <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold text-[10px]" x-text="filteredGallery.length + ' 张'"></span>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-2">
                        <select x-model="filterRatio" class="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs rounded-lg px-2 py-1.5 outline-none">
                            <option value="all">所有比例</option>
                            <option value="1:1">1:1</option>
                            <option value="16:9">16:9 / 9:16</option>
                            <option value="3:2">3:2 / 2:3</option>
                            <option value="4:5">4:5</option>
                        </select>
                        <button @click="haptic('light'); filterFav = !filterFav" :class="filterFav ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'" class="text-xs border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-lg spring-anim active:scale-95 flex items-center">
                            <i class="fas fa-heart mr-1" :class="filterFav ? 'text-pink-500' : 'text-slate-400'"></i> 收藏
                        </button>
                        
                        <div class="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1 hidden md:block"></div>
                        
                        <button x-show="!isBatch" @click="haptic('light'); isBatch = true" class="text-xs bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-lg spring-anim active:scale-95"><i class="fas fa-check-square mr-1"></i>批量</button>
                        <div x-show="isBatch" x-cloak class="flex items-center space-x-2 bg-blue-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-blue-200">
                            <button @click="haptic('medium'); batchDownload()" class="text-xs bg-blue-600 text-white px-3 py-1 rounded spring-anim active:scale-90">下载</button>
                            <button @click="haptic('medium'); batchDelete()" class="text-xs bg-red-600 text-white px-3 py-1 rounded spring-anim active:scale-90">删除</button>
                            <button @click="haptic('light'); isBatch = false; selectedItems=[]" class="text-xs text-slate-500 px-2 py-1"><i class="fas fa-times"></i></button>
                        </div>
                        <button @click="haptic('medium'); clearUnfav()" class="text-xs text-red-500 px-2.5 py-1.5 rounded-lg spring-anim active:scale-90 bg-red-50 dark:bg-red-500/10"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                
                <div class="flex-grow p-2 md:p-3 lg:p-5 bg-slate-50/50 dark:bg-transparent overflow-y-auto relative" x-ref="galleryContainer" style="max-height: calc(100vh - 200px);">
                    <div class="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3 lg:gap-4">
                        
                        <!-- 活跃任务队列 -->
                        <template x-for="task in activeTasks" :key="task.id">
                            <div class="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[200px] md:h-[240px]">
                                <template x-if="task.status === 'pending'">
                                    <div class="w-full h-24 md:h-32 bg-slate-200 dark:bg-slate-700 animate-pulse flex flex-col items-center justify-center p-3 md:p-4">
                                        <i class="fas fa-paint-brush text-xl md:text-2xl text-blue-400 mb-1 md:mb-2 animate-bounce"></i>
                                        <div class="w-full bg-slate-300 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                            <div class="bg-blue-500 h-full progress-bar-stripes transition-all duration-300" :style="\`width: \${task.progress}%\`"></div>
                                        </div>
                                    </div>
                                </template>
                                <template x-if="task.status === 'error'">
                                    <div class="w-full h-32 bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center p-4">
                                        <i class="fas fa-exclamation-triangle text-2xl text-red-400 mb-2"></i>
                                        <span class="text-xs font-bold text-red-500">生成失败</span>
                                        <span class="text-[10px] text-red-400 text-center mt-1 truncate w-full" x-text="task.errMsg"></span>
                                    </div>
                                </template>
                                <div class="p-3 flex flex-col flex-grow bg-slate-50/50 dark:bg-slate-800/50">
                                    <p class="text-xs text-slate-500 line-clamp-2 mb-2 italic" x-text="task.prompt"></p>
                                    <template x-if="task.status === 'error'">
                                        <div class="flex gap-2 mt-auto">
                                            <button class="flex-1 bg-blue-100 text-blue-600 text-xs py-1.5 rounded-lg spring-anim active:scale-95" @click="haptic('medium'); retryTask(task)">重试</button>
                                            <button class="flex-1 bg-red-100 text-red-600 text-xs py-1.5 rounded-lg spring-anim active:scale-95" @click="haptic('medium'); removeTask(task.id)">清除</button>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </template>

                        <div x-show="activeTasks.length === 0 && visibleGallery.length === 0" class="col-span-full text-slate-400 text-sm h-40 flex flex-col items-center justify-center">
                            <i class="fas fa-magic text-4xl mb-3 opacity-30"></i>
                            <p>无符合条件的记录</p>
                        </div>

                        <!-- 虚拟渲染画廊列表 -->
                        <template x-for="item in visibleGallery" :key="item.id">
                            <div class="gallery-item bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md spring-anim flex flex-col relative h-[180px] sm:h-[220px] md:h-[260px]">
                                <div x-show="isBatch" class="absolute top-2 left-2 z-20">
                                    <input type="checkbox" class="w-5 h-5 accent-blue-500 cursor-pointer" :value="item.id" x-model="selectedItems">
                                </div>
                                
                                <div class="relative w-full h-24 sm:h-28 md:h-36 bg-slate-100 dark:bg-slate-900 group overflow-hidden">
                                    <img :src="item.base64" loading="lazy" class="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105" @click="!isBatch && openLb(item)">
                                    <div class="absolute top-0 right-0 p-1.5 md:p-2 flex gap-1 md:gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition z-10 bg-gradient-to-bl from-black/50 to-transparent rounded-bl-xl">
                                        <button @click.stop="haptic('light'); toggleFav(item)" class="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center spring-anim hover:scale-110"><i class="fa-heart text-sm md:text-base" :class="item.isFavorite ? 'fas text-pink-500' : 'far text-white'"></i></button>
                                        <button @click.stop="haptic('medium'); deleteItem(item.id)" class="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-white spring-anim hover:scale-110 hover:text-red-400"><i class="fas fa-trash text-xs md:text-sm"></i></button>
                                    </div>
                                    <div class="absolute bottom-1 right-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-white/90" x-text="item.dimensions || '未知'"></div>
                                </div>
                                
                                <div class="p-3 flex flex-col flex-grow">
                                    <p class="text-[11px] md:text-xs text-slate-700 dark:text-slate-300 line-clamp-2 mb-1.5 font-medium flex-grow" x-text="item.prompt"></p>
                                    <div class="flex gap-1 text-[9px] mb-2 font-mono">
                                        <span class="bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600" x-text="item.ratio ? item.ratio.match(/[0-9]+:[0-9]+/) : '1:1'"></span>
                                        <span x-show="item.refCount > 0" class="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded"><i class="fas fa-image mr-1"></i><span x-text="item.refCount"></span></span>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2 mt-auto">
                                        <button class="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-[10px] md:text-xs py-1.5 rounded-lg spring-anim active:scale-95 font-medium text-slate-600 dark:text-slate-300" @click="haptic('light'); copyP(item.prompt, $el)"><i class="far fa-copy mr-1"></i>词</button>
                                        <button class="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] md:text-xs py-1.5 rounded-lg spring-anim active:scale-95 font-medium" @click="haptic('light'); useAsRef(item)"><i class="fas fa-magic mr-1"></i>垫图</button>
                                    </div>
                                </div>
                            </div>
                        </template>
                        
                        <!-- 懒加载触发器 -->
                        <div x-ref="loadMoreTrigger" class="h-10 w-full col-span-full"></div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex z-50 pb-safe" style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom));">
        <button @click="haptic('light'); currentTab = 'create'" class="flex-1 py-3.5 flex flex-col items-center spring-anim" :class="currentTab === 'create' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'">
            <i class="fas fa-paint-brush text-xl mb-1"></i><span class="text-[10px] font-bold">创作</span>
        </button>
        <button @click="haptic('light'); currentTab = 'gallery'" class="flex-1 py-3.5 flex flex-col items-center spring-anim relative" :class="currentTab === 'gallery' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'">
            <i class="fas fa-images text-xl mb-1"></i><span class="text-[10px] font-bold">画廊</span>
            <span x-show="activeTasks.filter(t=>t.status==='pending').length > 0" class="absolute top-2 right-[35%] w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
        </button>
    </nav>

    <script>
        // 使用国内加速 CDN（按优先级排序）
        const CDN_DOMAINS =[
            'https://fastly.jsdelivr.net/gh/wuyoscar/gpt_image_2_skill@main/',
            'https://gcore.jsdelivr.net/gh/wuyoscar/gpt_image_2_skill@main/',
            'https://cdn.jsdelivr.net/gh/wuyoscar/gpt_image_2_skill@main/',
            'https://cdn.statically.io/gh/wuyoscar/gpt_image_2_skill/main/',
            'https://unpkg.com/gh/wuyoscar/gpt_image_2_skill@main/'
        ];
        
        // 智能 CDN 选择：根据网络情况自动切换
        let currentCDNIndex = 0;
        function getImg(path) { 
            return CDN_DOMAINS[currentCDNIndex] + path; 
        }
        
        // CDN 故障自动切换
        function switchCDN() {
            if (currentCDNIndex < CDN_DOMAINS.length - 1) {
                currentCDNIndex++;
                console.log('Switching to CDN:', CDN_DOMAINS[currentCDNIndex]);
                // 重新加载所有图片
                document.querySelectorAll('img[src]').forEach(img => {
                    const oldSrc = img.src;
                    for (let i = 0; i < CDN_DOMAINS.length; i++) {
                        if (oldSrc.startsWith(CDN_DOMAINS[i])) {
                            const path = oldSrc.substring(CDN_DOMAINS[i].length);
                            img.src = getImg(path);
                            break;
                        }
                    }
                });
            }
        }

        const GLOBAL_PROMPT_LIBRARY =[
            {
                category: '🎌 动漫与漫画',
                items:[
                    { title: '咖啡馆时尚写真', ratio: ' 画面比例: 3:4', path: 'docs/anime-manga/anime-cafe-stockings-fashion.png', img: getImg('docs/anime-manga/anime-cafe-stockings-fashion.png'), prompt: 'Create a tasteful portrait-oriented anime fashion illustration of an adult woman, age 24, with a cute playful expression, looking at the camera in a cozy European cafe at golden hour. She wears a cream blouse, charcoal pleated skirt, tailored cropped jacket, sheer black stockings, loafers, and a small ribbon hair clip; she is seated sideways at a small marble table with latte art, a sketchbook, and warm window light. Composition: three-quarter fashion portrait, elegant legs visible but relaxed and non-explicit, wholesome editorial mood, no nudity, no lingerie, no school uniform, no explicit pose, adult character only. Use polished modern anime rendering, crisp line art, luminous eyes, soft cel shading, subtle fabric texture, gentle blush, background bokeh, and a refined magazine-cover color palette.' },
                    { title: '霓虹街机时尚写真', ratio: ' 画面比例: 3:4', path: 'docs/anime-manga/anime-arcade-stockings-fashion.png', img: getImg('docs/anime-manga/anime-arcade-stockings-fashion.png'), prompt: 'Create a portrait-oriented anime fashion illustration of an adult woman, age 25, in a neon arcade district at night. She has a cute confident smile and looks directly at the viewer while standing beside glowing claw machines and retro game cabinets. Outfit: black turtleneck, red satin bomber jacket, high-waisted skirt, patterned dark stockings, platform shoes, small crossbody bag, star earrings. Composition: full-body fashion portrait with strong silhouette, neon reflections on wet pavement, vending machines, sticker-covered walls, colorful signage, and cinematic rim light. Keep the pose playful but non-explicit, no nudity, no lingerie, no fetish framing, adult character only. Use high-end anime key visual rendering, crisp line art, saturated magenta-cyan lighting, clean readable background details, and glossy cyber-pop atmosphere.' },
                    { title: '路边反光镜自拍', ratio: ' 画面比例: 3:4', path: 'docs/anime-manga/anime-roadside-mirror-fashion.png', img: getImg('docs/anime-manga/anime-roadside-mirror-fashion.png'), prompt: 'Create a portrait-oriented anime fashion illustration of an adult woman, age 24, taking a playful roadside mirror selfie in the reflection of a parked scooter mirror on a quiet Tokyo side street. She looks into the mirror with a bright mischievous smile, one hand making a small peace sign near her cheek, the other holding a phone with a cute sticker case. Outfit: soft ivory knit cardigan, navy pleated skirt, sheer black stockings, loafers, small shoulder bag, ribbon hair clip, tasteful everyday street fashion. Composition: the mirror reflection is the main frame, with blurred street signs, vending machine glow, crosswalk stripes, and spring evening light around the mirror edge. Keep the pose cute, stylish, and non-explicit; no nudity, no lingerie, no fetish framing, adult character only. Use polished modern anime rendering, crisp line art, luminous eyes, soft cel shading, warm reflections, natural street-photo energy, and a charming slice-of-life mood.' },
                    { title: 'MAPPA 动作定格', ratio: ' 画面比例: 16:9', path: 'docs/anime-manga/anime-jjk-action.png', img: getImg('docs/anime-manga/anime-jjk-action.png'), prompt: '一幅采用MAPPA公司制作的《咒术回战》（2020年电视动画）视觉风格的动画动作定格画面。横向16:9比例。一位银白发的年轻男子，穿着深海军蓝色校服夹克，眼戴蓝色眼罩，处于战斗中期姿势——一只手掌向外伸展，释放出一个旋转的浓密蓝色能量球，球的边缘有雷电般的闪光。对面是由液态黑色物质组成的恶魔阴影生物，拥有多个眼睛，从右侧猛扑过来。背景：黄昏时的破败城市街道，碎裂的柏油路面，裂开的霓虹汉字招牌“呪術”以断裂的红色LED灯显示，被毁坏的车辆，瓦砾被冲击波悬浮在半空中，雨点在空中捕捉停留。艺术指导：MAPPA风格的数字二维动画——重厚的卡通阴影，清晰的线条艺术，两人物体带有边缘光，能量球周围带有运动模糊光线。色彩方案采用深海军蓝、电青色、猩红色点缀。动感冲击构图。' },
                    { title: '火影忍者战斗视觉图', ratio: ' 画面比例: 16:9', path: 'docs/anime-manga/anime-naruto-clash.png', img: getImg('docs/anime-manga/anime-naruto-clash.png'), prompt: '一幅少年动漫战斗关键视觉图，采用Pierrot工作室制作的《火影忍者疾风传》视觉风格。横向16:9比例。两个忍者人物在空中激烈碰撞，正处于他们标志招式交汇的瞬间——左侧战士右手掌发出发光的蓝色螺旋查克拉，右侧战士右手掌握有噼啪作响的白色闪电刀刃。碰撞点发出圆形冲击波。两名战士均佩戴护额，左侧：金色刺猬发型，脸颊有胡须状标记；右侧：黑发，一只红色写轮眼似的三勾玉眼睛。背景：夜晚的山谷，破裂的土地，倒塌中的巨大神树，樱花花瓣被冲击波卷起。动态透视，冲突中心放射强烈速度线。' },
                    { title: '少年漫画双页版面', ratio: ' 画面比例: 16:9', path: 'docs/anime-manga/manga-spread.png', img: getImg('docs/anime-manga/manga-spread.png'), prompt: '一幅黑白少年漫画双页版面（横向16:9作为单一画面，带有微弱的中央分割线）。高对比墨线与网点，周刊少年Jump篮球漫画传统。构图：5个不规则格子加一个跨越两页右下方的大斜格子，呈现高潮扣篮场面。左上角：主角锐利眼神特写；右上角：对手震惊表情；右下大斜格：主角扣篮，巨大的墨迹书法汉字"決"填满负空间。专业漫画家品质，自信的墨线，戏剧化的网点渐变，扣篮发散的速度线。' },
                    { title: '10宫格动漫角色设定板', ratio: ' 画面比例: 16:9', path: 'docs/anime-manga/anime-ten-panel-character-grid.png', img: getImg('docs/anime-manga/anime-ten-panel-character-grid.png'), prompt: 'Create a single landscape image containing a clean 2×5 ten-panel anime character grid. Each panel shows a different adult young woman, age 22 to 26, designed as a cute gentle heroine archetype. Keep all panels consistent in art direction: modern polished anime, crisp line art, soft cel shading, luminous eyes, pastel accent colors, tidy white gutters, small readable name tag at the bottom of each panel. The overall board should feel like a collectible anime cast sheet / ten-grid poster, cute and wholesome.' },
                    { title: '16格动漫表情网格', ratio: '', path: 'docs/anime-manga/anime-expression-grid.png', img: getImg('docs/anime-manga/anime-expression-grid.png'), prompt: '创建一个16格表情网格，描绘一个银发、蓝眼的动漫女孩。她的脸型、发型和服装在所有格子中必须保持高度一致。16种表情包括：开心、伤心、生气、惊讶、害羞、无语、邪恶笑容、沉思、好奇、自豪、委屈、轻蔑、困惑、害怕、哭泣，以及一个心形表情。' },
                    { title: '原创漫画样张', ratio: ' 画面比例: 9:16', path: 'docs/anime-manga/tide-brothers-19-page-manga.png', img: getImg('docs/anime-manga/tide-brothers-19-page-manga.png'), prompt: 'Create one tall manga chapter proof sheet containing 19 numbered miniature pages for an original shonen pirate manga, not based on any existing series. Title: "TIDE BROTHERS: THE STARFALL MAP". Main characters: Rune, a cheerful rubbery-armed young pirate captain; and Ash, his older flame-wielding brother. Show 19 small pages arranged as a readable contact sheet, each page with 1 to 3 manga panels, black-and-white ink, screentone, dynamic speed lines, expressive faces, and clear speech bubbles. Classic weekly shonen manga energy.' }
                ]
            },
            {
                category: '🎮 游戏设计与HUD',
                items:[
                    { title: 'Hitman 游戏演示', ratio: ' 画面比例: 16:9', path: 'docs/gaming/hitman-openai.png', img: getImg('docs/gaming/hitman-openai.png'), prompt: '一个 Hitman 关卡，你在 OpenAI 总部，你的任务是在不被发现的情况下盗取 GPT-6模型数据。' },
                    { title: 'GTA 6 游戏演示', ratio: ' 画面比例: 16:9', path: 'docs/gaming/gta6-beach.png', img: getImg('docs/gaming/gta6-beach.png'), prompt: 'GTA 6 游戏内画面，非常详细，非常逼真。从一台静止的 4k 显示器拍摄的特写镜头。（画面有轻微模糊，感觉像是手持拍摄）。宽广明亮的环境。逼真的细节。角色与狗一起在海滩上行走。' },
                    { title: '暗黑奇幻首领狩猎', ratio: ' 画面比例: 16:9', path: 'docs/gaming/dark-fantasy-hunt.png', img: getImg('docs/gaming/dark-fantasy-hunt.png'), prompt: '创作一个原创 AAA 级暗黑奇幻动作 RPG 截图。银发的怪物猎人身穿多层皮甲，站在蓝调时刻的废弃沼泽中，拔剑指向从迷雾中升起的巨大战翼沼泽兽。电影化的肩部过肩镜头，可信的 HUD，包含生命值、耐力、药水图标、任务文本和小地图。湿石，枯树，火把光，月光雾气。' },
                    { title: '史诗伙伴桥梁', ratio: ' 画面比例: 16:9', path: 'docs/gaming/epic-fellowship-bridge.png', img: getImg('docs/gaming/epic-fellowship-bridge.png'), prompt: '创作一个原创史诗奇幻 RPG 关键艺术截图。一小队旅行者穿越一座巨大的古石桥，朝向日出时分发光的山城前进。巨大山谷、瀑布、金色云朵，电影级规模，微妙的 HUD 任务标记和指南针，AAA 级奇幻冒险风格，16:9 横向，高度细节和振奋人心。' },
                    { title: '复古日式城镇 RPG', ratio: ' 画面比例: 16:9', path: 'docs/gaming/retro-japan-rpg.png', img: getImg('docs/gaming/retro-japan-rpg.png'), prompt: '创作一个等角像素艺术 RPG 截图，描绘传统日本村庄的樱花季。樱花花瓣飘落空中，武士玩家角色在广场练习剑法。界面包含物品栏、耐力条、技能冷却计时器和微妙的任务 UI。温馨复古主机氛围，清晰像素细节。' },
                    { title: '赛博欧洲动作 HUD', ratio: ' 画面比例: 16:9', path: 'docs/gaming/cyberpunk-europe-action.png', img: getImg('docs/gaming/cyberpunk-europe-action.png'), prompt: '创作一张第三人称赛博朋克动作游戏截图，设定在一个霓虹灯照耀的欧洲首都夜晚。主角拥有发光的赛博义体，站在雨水打湿的街道上。添加一个精致的游戏 HUD，包含生命条、弹药数、雷达、潜行/能量仪表和任务叠加。鲜艳的青品红调色板，湿润反射，电影级强度。' },
                    { title: '动漫风开放世界 HUD', ratio: ' 画面比例: 16:9', path: 'docs/gaming/anime-open-world.png', img: getImg('docs/gaming/anime-open-world.png'), prompt: '创作一张第三人称肩膀视角的怀旧动漫风开放世界冒险游戏截图。主角站在茂密森林中，细节丰富的植被和鲜艳阴影，拉弓瞄准远处敌人。添加清晰的屏幕 HUD：任务日志，顶部的指南针，左下角的角色头像和状态效果。' },
                    { title: '手机 MOBA 竞技场', ratio: ' 画面比例: 16:9', path: 'docs/gaming/mobile-moba-arena-hud.png', img: getImg('docs/gaming/mobile-moba-arena-hud.png'), prompt: '创建一张原创横版手机 MOBA / 动作 RPG 游戏截图，精致移动端 HUD。金色黄昏中的明亮幻想竞技场，三名风格化英雄在中央河道交战。左下角半透明虚拟摇杆，右下角四个圆形技能按钮并带冷却数字，顶部中央比分栏，小地图。高品质 anime-fantasy 3D 手机游戏。' },
                    { title: '暗黑奇幻设定板', ratio: '', path: 'docs/gaming/worldbuilding-nine-panel-set.png', img: getImg('docs/gaming/worldbuilding-nine-panel-set.png'), prompt: 'Create a square 3x3 worldbuilding set for an original dark-fantasy universe called "Saltwind Reach". Each panel is a distinct but consistent scene: a storm-battered coastal fortress at dawn, a foggy market street, a knight relic close-up, a handwritten map fragment, a monster silhouette study, a candlelit tavern interior, an alchemist kit flat lay, a moonlit harbor, and a faction banner concept. Cohesive art direction: painterly realism, muted teal / rust / bone palette.' }
                ]
            },
            {
                category: '🤖 复古与赛博朋克',
                items:[
                    { title: '赛博朋克机甲少女', ratio: ' 画面比例: 16:9', path: 'docs/retro-cyberpunk/cyberpunk-mecha.png', img: getImg('docs/retro-cyberpunk/cyberpunk-mecha.png'), prompt: '一位十几岁的机甲少女，苍白的皮肤沾染着煤烟和盐雾，锐利的琥珀色眼睛带有发光的HUD准星，及腰的灰白色头发绑成高马尾，哑光枪金属外骨骼装甲护住肩膀、前臂和小腿，巨大的轨道炮架在右肩。站在倾斜钢平台生锈的边缘，黄昏时分废弃海上城市。电影感动漫主视觉，胶片颗粒。' },
                    { title: 'Neon Orchid 设定板', ratio: ' 画面比例: 16:9', path: 'docs/retro-cyberpunk/neon-orchid-district-board.png', img: getImg('docs/retro-cyberpunk/neon-orchid-district-board.png'), prompt: 'Create a cyberpunk character-and-city design board in a premium magazine-layout format, landscape 16:9. Title text: "NEON ORCHID DISTRICT". Divided into five asymmetric panels: one large cinematic street scene of a rain-soaked elevated night market, two close-up portrait panels of original adult cyberpunk couriers, one small isometric map panel, and one artifact panel. Layered neon magenta, cyan, acid green, wet asphalt reflections.' },
                    { title: 'Synth Moon 夜生活', ratio: '', path: 'docs/retro-cyberpunk/synth-moon-crew-grid.png', img: getImg('docs/retro-cyberpunk/synth-moon-crew-grid.png'), prompt: 'Create a square cyberpunk alien nightclub catalog sheet called "SYNTH MOON CREW". Layout: a clean 3×3 grid of nine cards with thin chrome borders. Each card shows a different original alien or android nightlife character. Polished late-90s anime cyberpunk aesthetic, black background, fluorescent rim lights, glossy materials, sticker-like UI glyphs.' }
                ]
            },
            {
                category: '🎬 电影与动画',
                items:[
                    { title: '皮克斯风格小猫', ratio: ' 画面比例: 16:9', path: 'docs/cinematic-animation/pixar-kitchen.png', img: getImg('docs/cinematic-animation/pixar-kitchen.png'), prompt: '一个皮克斯品质的3D动画静帧，横向16:9。电影剧场版风格，温暖的工作室灯光。黎明时分一间温馨的公寓厨房，一个橘色虎斑小猫坐在台面上，伸出爪子向烤箱里正在上升的舒芙蕾触碰。小猫有着富有表现力的眼睛（经典皮克斯比例），单根雕琢的胡须，逼真的毛发带有微型梳理方向。全CG皮克斯美学。' },
                    { title: '1940年代黑色电影', ratio: ' 画面比例: 16:9', path: 'docs/cinematic-animation/noir-detective.png', img: getImg('docs/cinematic-animation/noir-detective.png'), prompt: '一张1940年代黑色电影黑白电影静帧，横向16:9，高对比度。用35毫米胶片拍摄，带有可见颗粒。凌晨2点，穿着风衣和软呢帽的侦探独自站在雨湿的街角，手里拿着香烟，烟雾盘旋上升。湿润的鹅卵石反射着一盏嗡嗡作响的街灯光。经典明暗对比法，强硬的主光源从右上方照射，后墙投下百叶窗阴影。' },
                    { title: '专业6格电影分镜', ratio: ' 画面比例: 16:9', path: 'docs/cinematic-animation/storyboard.png', img: getImg('docs/cinematic-animation/storyboard.png'), prompt: '一个6格电影分镜，布局为3×2网格，整体横向16:9。每个格子是一个矩形的铅笔和马克笔速写，带有白色边距和下方的小信息条。场景：一场穿越东京雨巷的追逐，最终在屋顶跳跃。包含宽景、跟踪镜头、特写、低角度和航拍。经典动画学派分镜——铅笔线条，灰色马克笔阴影，红铅笔箭头注释摄像机移动。' },
                    { title: '吉卜力风格小屋', ratio: ' 画面比例: 16:9', path: 'docs/cinematic-animation/ghibli-cottage.png', img: getImg('docs/cinematic-animation/ghibli-cottage.png'), prompt: '一个吉卜力风格手绘动画静帧，横向16:9。一座小木屋坐落在长满草的山坡上，俯瞰山谷的金色时刻。一名赤脚孩子站在木屋门口，向藏在草丛中的小毛茸茸森林精灵挥手。经典宫崎骏水彩与蛋彩画风。柔和的画笔边缘，稍微去饱和的绿色和温暖的肤色，云朵和草地上可见刷子质感。' },
                    { title: 'VHS杂货店混乱', ratio: ' 画面比例: 16:9', path: 'docs/cinematic-animation/vhs-grocery-chaos.png', img: getImg('docs/cinematic-animation/vhs-grocery-chaos.png'), prompt: '创建一个1990年代杂货店的混乱监控摄像头静帧。一个穿着全套中世纪盔甲的男子定格在奔跑中，偷窃了几只烤鸡，正经过乳制品区。头顶的荧光灯在盔甲上反光。加上一个时间戳“08/13/96 04:44 AM”和墙上海报写着“新！烤面包机千层酥！”。画面画质低，荒诞且稍显激烈，有运动模糊、VHS色彩溢出和监控噪音。' }
                ]
            },
            {
                category: '👤 角色设计',
                items:[
                    { title: '官方角色参考图', ratio: ' 画面比例: 16:9', path: 'docs/character-design/character-sheet.png', img: getImg('docs/character-design/character-sheet.png'), prompt: '基于此角色和背景，请创建一份类似官方设定资料的角色参考图。包含三视图绘制：正面、侧面和背面。添加角色面部表情的多样变化，细分并展示服装和装备的详细部件，添加调色板，包含世界观设定的简要说明。整体采用有条理的布局（白色背景，插画风格）。' },
                    { title: '弓箭手概念图', ratio: ' 画面比例: 3:4', path: 'docs/character-design/elven-archer-sheet.png', img: getImg('docs/character-design/elven-archer-sheet.png'), prompt: '创建一页以神秘精灵弓箭手为核心、穿着飘逸长袍的奇幻概念艺术素描簿页面。用松散的石墨笔触绘制主角轮廓，并用精确的墨线细节表现。主画周围环绕侧视图，展示披风变体，一幅半成品的带尺寸标注的弓研究，缩略的动作姿势，关于魔法刺绣图案的手写注释，及森林绿和银色晕染到页边的淡水彩测试。此页应如同真正艺术总监的开发稿。' }
                ]
            },
            {
                category: '📝 海报与排版',
                items:[
                    { title: '重庆雨夜城市宣传', ratio: ' 画面比例: 3:4', path: 'docs/typography-posters/city-tourism-promo-poster.png', img: getImg('docs/typography-posters/city-tourism-promo-poster.png'), prompt: '做一张 3:4 城市宣传海报，主题是"山城雨夜·重庆"。整体像高端城市文旅 campaign poster。画面中心是层叠山城建筑、轻轨穿楼、湿润街道、霓虹倒影、江边雾气和夜色中的坡道。用现代中文排版，加入少量准确标题与副标题："山城雨夜" / "CHONGQING" / "8D 城市 / 江雾 / 火锅 / 轻轨 / 夜景"。色彩以深蓝、暖橙、湿润霓虹红为主。' },
                    { title: 'Vogue 时尚封面', ratio: ' 画面比例: 3:4', path: 'docs/typography-posters/vogue-cover.png', img: getImg('docs/typography-posters/vogue-cover.png'), prompt: '一张高端时尚杂志封面，3:4 竖版，Vogue Paris 编辑风格。主体：一位高挑女性模特，三十多岁，侧身三分之四朝向镜头，眼神直接锐利。穿着一件雕塑感强烈的象牙色高领羊毛大衣，内搭深茄紫色丝质吊带裙。背景：柔和水泥灰无缝纸背景。精确封面文字（全英文）：铭牌标题巨大大写衬线体白色 "VOGUE"，主要封面标题粗体无衬线体居中 "THE QUIET POWER ISSUE"。' },
                    { title: '复古科幻杂志封面', ratio: ' 画面比例: 3:4', path: 'docs/typography-posters/pulp-scifi-cover.png', img: getImg('docs/typography-posters/pulp-scifi-cover.png'), prompt: '一张1950年代复古科幻通俗杂志封面，3:4 竖版。经典风格 — 手绘水粉画插图，通俗黄色纸张纹理，边缘带微黄棕色旧纸色调。一艘铬银色火箭船下降到一个异星红色沙漠星球上。前景左侧一名独立宇航员，头戴1950年代风格玻璃圆顶头盔，手持射线枪，面对多触手半透明绿色生物。精确排版：顶部大写 "ASTOUNDING STORIES"。' }
                ]
            },
            {
                category: '🎨 插画与水彩',
                items:[
                    { title: '复古阿马尔菲海报', ratio: ' 画面比例: 3:4', path: 'docs/illustration/amalfi-poster.png', img: getImg('docs/illustration/amalfi-poster.png'), prompt: '现代铅笔插画风格的复古旅游海报插画，主题是意大利阿马尔菲海岸，展示全景沿海悬崖公路场景，经典1960年代白色汽车沿着弯曲的海边道路行驶，深蓝色地中海海面上有小帆船，色彩丰富的粉彩色山丘村落。复古1950年代旅游海报风格，高细节，丝网印刷质感，图形插画，手绘风格。' },
                    { title: '纸雕森林夜市', ratio: ' 画面比例: 16:9', path: 'docs/illustration/papercut-forest-market.png', img: getImg('docs/illustration/papercut-forest-market.png'), prompt: 'Create a landscape editorial illustration in layered paper-cut style: a tiny forest night market hidden beneath giant mushrooms and fern leaves. Include warm lantern stalls selling acorn cakes, beetle taxis, a fox calligrapher, a badger tea vendor, children holding leaf umbrellas, and fireflies forming soft dotted paths. Visible cut-paper edges, soft shadows between layers, muted moss green, pumpkin orange, cream, and ink-blue palette.' },
                    { title: '雨中植物温室水彩', ratio: ' 画面比例: 16:9', path: 'docs/watercolor/rainy-botanical-greenhouse.png', img: getImg('docs/watercolor/rainy-botanical-greenhouse.png'), prompt: 'Create a delicate watercolor illustration of a rainy botanical greenhouse in early morning. Transparent washes, granulating pigments, soft wet-on-wet blooms, visible cold-pressed paper texture. Scene: arched glass greenhouse ribs, raindrops streaming down panes, hanging ferns, orchids, clay pots, a narrow stone path, a wooden bench with an open gardening notebook, and diffused silver daylight. Sage green, eucalyptus gray, pale lavender.' },
                    { title: '宋代夜市手卷', ratio: ' 画面比例: 16:9', path: 'docs/ink-chinese/song-night-market-scroll.png', img: getImg('docs/ink-chinese/song-night-market-scroll.png'), prompt: 'Create a horizontal Chinese ink-and-wash handscroll scene of a Song dynasty riverside night market. Use gongbi-level architectural detail combined with loose ink atmosphere: arched stone bridge, lantern boats, teahouse balconies, book stalls, noodle steam, scholars reading under lamps. Add small readable Chinese shop signs in brush style: "茶", "书", "面", "灯市". Palette: black ink, warm lantern ochre, pale blue-gray moonlight.' }
                ]
            },
            {
                category: '👾 像素与等距视图',
                items:[
                    { title: '像素汽车精灵图集', ratio: '', path: 'docs/pixel-art/pixel-sprite-cars.png', img: getImg('docs/pixel-art/pixel-sprite-cars.png'), prompt: '一个10x10的像素艺术复古电子游戏汽车精灵图集，16位时代美学。十行十列的小型车辆精灵，背景为干净的浅灰色网格。精灵种类多样：轿车、跑车、肌肉车、SUV、皮卡、警车等，色彩丰富。所有精灵均采用一致的3/4俯视角度渲染，阴影一致，像素边缘清晰，无抗锯齿。' },
                    { title: '像素艺术早餐静物', ratio: '', path: 'docs/pixel-art/pixel-breakfast.png', img: getImg('docs/pixel-art/pixel-breakfast.png'), prompt: '创造一个怀旧的像素艺术早餐静物。展示一叠绵软金黄的松饼，上面淋有光亮的枫糖浆，顶端摆放草莓和蓝莓，像素化的蒸汽从中升腾而起。盘子放在浅色桌布上，背景有一杯热咖啡。使用丰富的早餐色彩，精心的光照和美味的纹理细节，同时保持干净、清晰易读的像素艺术风格。' },
                    { title: '等距奇幻村庄地图', ratio: '', path: 'docs/isometric/isometric-fantasy-village.png', img: getImg('docs/isometric/isometric-fantasy-village.png'), prompt: '创建一个充满活力的等距视图奇幻村庄地图，采用干净的基于网格布局。包括茅草屋顶的木屋、鹅卵石小路和中央石制喷泉。地图的一角升起一个小草坪小丘，设有连接较低地面的楼梯。保持等距角度精准且适合游戏使用。温暖的阳光投射出清晰的光线和长长的阴影在屋顶上。' }
                ]
            },
            {
                category: '📦 产品包装与展示',
                items:[
                    { title: '3D产品盒展开', ratio: ' 画面比例: 3:4', path: 'docs/product-food/product-dieline-box.png', img: getImg('docs/product-food/product-dieline-box.png'), prompt: '将展开图组装成一个完美的3D盒子，面板准确，折痕干净，文字不失真，图案完全保留。竖直拍摄，采用精致的三分之三角度，极简高端工作室布景，柔和中性色背景。盒子正面写有"AURAE / COLD-BREW MATCHA / 12 fl oz"，采用干净的无衬线字体。风格干净、编辑感强，获奖级产品照美学。' },
                    { title: '巧克力威化渲染', ratio: ' 画面比例: 3:4', path: 'docs/product-food/product-chocolate-wafer.png', img: getImg('docs/product-food/product-chocolate-wafer.png'), prompt: '/* PRODUCT_RENDER_CONFIG: 巧克力威化榛子版, 美学: 高端商业食品摄影 */ { "ENVIRONMENT": { "Background": "Gradient(Dark_Warm_Brown)", "Atmospheric_FX":["Floating_Particles", "Depth_Blur", "Cinematic_Bokeh"], "Lighting": { "Type": "Directional_Studio_Warmer" } }, "CORE_ASSETS": { "Primary_Subject": "Wafer_Rolls", "Physics": "Zero_Gravity_Diagonal_X_Composition", "Material_Properties": { "Outer": "Milk_Chocolate_Coating", "Surface_Texture": "Irregular_Nut_Clusters_Embedded" } }, "PARTICLE_SYSTEMS":[ { "Object": "Chocolate_Blocks", "State": "Floating" }, { "Object": "Hazelnuts", "State": "Halved_and_Fragmented" } ], "RENDER_OUTPUT": { "Resolution": "8K_UHD", "Aspect_Ratio": "3:4" } }' },
                    { title: '通用茶饮商业海报', ratio: ' 画面比例: 3:4', path: 'docs/product-food/aurora-oolong-poster.png', img: getImg('docs/product-food/aurora-oolong-poster.png'), prompt: '设计一张名为"Aurora Oolong Cold Brew"的高端商业海报。极简风格，干净构图，主角瓶和茶杯居中，柔和工作室灯光，真实材质纹理，优雅的水汽细节，充足的留白空间，高端品牌视觉语言，电影光影，精致包装字体排版，极致细节处理。豪华饮品广告感觉，可用于地铁灯箱或时尚杂志。' }
                ]
            }
        ];

        let db = null;
        const DB_NAME = "AIGallery_Alpine";
        const DB_VERSION = 2; // 增加版本号以触发升级
        const initDB = (onSuccess) => {
            try {
                // 检查浏览器是否支持 IndexedDB
                if (!window.indexedDB && !window.mozIndexedDB && !window.webkitIndexedDB && !window.msIndexedDB) {
                    console.warn("IndexedDB is not supported in this browser");
                    return onSuccess();
                }
                
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                
                req.onupgradeneeded = (e) => {
                    db = e.target.result;
                    // 删除旧的对象存储（如果存在）
                    if (db.objectStoreNames.contains('images')) {
                        db.deleteObjectStore('images');
                    }
                    // 创建新的对象存储
                    const store = db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('IndexedDB upgraded to version', db.version);
                };
                
                req.onsuccess = (e) => { 
                    db = e.target.result; 
                    console.log('IndexedDB initialized successfully (version ' + db.version + ')');
                    
                    // 验证对象存储是否存在
                    if (!db.objectStoreNames.contains('images')) {
                        console.warn('Object store "images" not found, closing and reopening with upgrade');
                        db.close();
                        const upgradeReq = indexedDB.open(DB_NAME, DB_VERSION + 1);
                        upgradeReq.onupgradeneeded = (e) => {
                            const newDb = e.target.result;
                            if (!newDb.objectStoreNames.contains('images')) {
                                const store = newDb.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                            }
                        };
                        upgradeReq.onsuccess = (e) => {
                            db = e.target.result;
                            console.log('IndexedDB re-initialized with object store');
                            onSuccess();
                        };
                        upgradeReq.onerror = (e) => {
                            console.warn('Failed to reopen with upgrade', e);
                            onSuccess();
                        };
                        return;
                    }
                    
                    onSuccess(); 
                };
                
                req.onerror = (e) => { 
                    console.warn("IndexedDB initialization failed, falling back to memory-only mode", e);
                    onSuccess(); 
                };
                
                req.onblocked = (e) => {
                    console.warn("IndexedDB blocked by another tab");
                    onSuccess();
                };
            } catch (e) {
                console.warn("IndexedDB not supported in this environment, using memory storage", e);
                onSuccess();
            }
        };

        document.addEventListener('alpine:init', () => {
            Alpine.data('appData', () => ({
                modelName: '${MODEL_NAME}',
                theme: localStorage.getItem('ai_theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
                currentTab: 'create',
                prompt: '',
                ratio: localStorage.getItem('ai_pref_ratio') || '',
                count: parseInt(localStorage.getItem('ai_pref_count')) || 1,
                ratioOptions:[
                    { val: '', label: '1:1', iconClass: 'w-5 h-5' },
                    { val: ' 画面比例: 3:2', label: '3:2', iconClass: 'w-6 h-4' },
                    { val: ' 画面比例: 2:3', label: '2:3', iconClass: 'w-4 h-6' },
                    { val: ' 画面比例: 16:9', label: '16:9', iconClass: 'w-7 h-4' },
                    { val: ' 画面比例: 9:16', label: '9:16', iconClass: 'w-4 h-7' },
                    { val: ' 画面比例: 4:5', label: '4:5', iconClass: 'w-4 h-5' }
                ],
                refFiles: [], 
                gallery:[],
                visibleCount: 30, // 虚拟列表初始渲染数量
                
                // 任务持久化恢复
                activeTasks: JSON.parse(localStorage.getItem('ai_active_tasks') || '[]').map(t => {
                    if (t.status === 'pending') {
                        t.status = 'error';
                        t.errMsg = '任务中断，请重试';
                    }
                    return t;
                }),
                
                toasts:[],
                modal: { open: false, title: '', desc: '', onConfirm: ()=>{} },
                filterRatio: 'all', filterFav: false,
                isBatch: false, selectedItems:[],
                lb: { open: false, item: null, scale: 1, x: 0, y: 0 },
                dragInfo: { isDragging: false, startX: 0, startY: 0 },
                
                // API 信息弹窗
                apiInfo: { 
                    open: false,
                    apiKey: '${API_KEYS[0]}'.substring(0, 8) + '...' + '${API_KEYS[0]}'.substring('${API_KEYS[0]}'.length - 8)
                },
                
                isLabOpen: false, 
                promptLibrary: GLOBAL_PROMPT_LIBRARY,
                labPreview: { open: false, item: null },

                init() {
                    initDB(() => this.fetchGallery());
                    document.addEventListener('paste', this.handlePaste.bind(this));
                    
                    // 按钮波纹效果事件代理
                    document.addEventListener('click', (e) => {
                        const btn = e.target.closest('.ripple-btn');
                        if (btn) {
                            const rect = btn.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;
                            const ripple = document.createElement('span');
                            ripple.className = 'ripple-effect';
                            ripple.style.left = \`\${x}px\`;
                            ripple.style.top = \`\${y}px\`;
                            ripple.style.width = ripple.style.height = \`\${Math.max(rect.width, rect.height)}px\`;
                            btn.appendChild(ripple);
                            setTimeout(() => ripple.remove(), 800);
                        }
                    });

                    // 虚拟列表懒加载监听
                    const observer = new IntersectionObserver((entries) => {
                        if(entries[0].isIntersecting) this.loadMore();
                    }, { rootMargin: '300px' });
                    setTimeout(() => {
                        if(this.$refs.loadMoreTrigger) observer.observe(this.$refs.loadMoreTrigger);
                    }, 500);
                },

                // 触感反馈引擎 (Haptics)
                haptic(type = 'light') { 
                    if (!navigator.vibrate) return;
                    try {
                        if (type === 'light') navigator.vibrate(15);
                        else if (type === 'medium') navigator.vibrate(30);
                        else if (type === 'heavy') navigator.vibrate([40, 10, 20]);
                        else if (type === 'success') navigator.vibrate([10, 30, 10, 30, 20]);
                        else if (type === 'error') navigator.vibrate([50, 30, 50]);
                    } catch(e) {}
                },

                showToast(msg, type='info') {
                    const id = Date.now();
                    this.toasts.push({ id, msg, type, visible: true });
                    setTimeout(() => {
                        const t = this.toasts.find(x => x.id === id);
                        if(t) t.visible = false;
                        setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== id); }, 300);
                    }, 3000);
                },

                confirmReq(title, desc, onConfirm) {
                    this.modal.title = title; this.modal.desc = desc;
                    this.modal.onConfirm = onConfirm; this.modal.open = true;
                },

                // 灵感图库
                openLabPreview(item) {
                    this.labPreview.item = item;
                    this.labPreview.open = true;
                },
                useLabPrompt(event) {
                    this.prompt = this.labPreview.item?.prompt || '';
                    if(this.labPreview.item?.ratio !== undefined) {
                        this.ratio = this.labPreview.item.ratio;
                        localStorage.setItem('ai_pref_ratio', this.ratio);
                    }
                    this.labPreview.open = false;
                    this.isLabOpen = false;
                    this.showToast('✨ 灵感已自动载入创作台', 'success');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                },
                handleImgError(e, path) {
                    const img = e.target;
                    const currentSrc = img.src;
                    if (!currentSrc) return;
                    
                    // 尝试下一个 CDN
                    let switched = false;
                    for (let i = 0; i < CDN_DOMAINS.length - 1; i++) {
                        if (currentSrc.startsWith(CDN_DOMAINS[i])) {
                            const fallbackPath = path || currentSrc.substring(CDN_DOMAINS[i].length);
                            img.src = CDN_DOMAINS[i + 1] + fallbackPath;
                            switched = true;
                            break;
                        }
                    }
                    
                    // 如果所有 CDN 都失败，切换到下一个 CDN 并重试
                    if (!switched && currentCDNIndex < CDN_DOMAINS.length - 1) {
                        switchCDN();
                    }
                },

                // 参考图处理
                handleFileSelect(e) { this.processFiles(e.target.files); },
                handleDrop(e) { this.processFiles(e.dataTransfer.files); },
                handlePaste(e) {
                    if(e.target.tagName === 'TEXTAREA') return;
                    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                    let files =[];
                    for(let i in items) {
                        if(items[i].kind === 'file' && items[i].type.includes('image')) files.push(items[i].getAsFile());
                    }
                    this.processFiles(files);
                },
                processFiles(files) {
                    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
                    if(valid.some(f => f.size > 10*1024*1024)) return this.showToast('单张图片不能超过 10MB', 'error');
                    valid.forEach(f => {
                        if(this.refFiles.length < 4) this.refFiles.push({ file: f, url: URL.createObjectURL(f) });
                    });
                },
                removeRef(idx) {
                    URL.revokeObjectURL(this.refFiles[idx].url);
                    this.refFiles.splice(idx, 1);
                },
                getBase64(file) {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = error => reject(error);
                    });
                },
                async base64ToBlob(base64) {
                    const res = await fetch(base64);
                    return await res.blob();
                },

                // 任务持久化
                saveTasks() {
                    const tasksToSave = this.activeTasks.map(t => ({
                        id: t.id, status: t.status, progress: t.progress, 
                        prompt: t.prompt, ratio: t.ratio, refCount: t.refCount, 
                        errMsg: t.errMsg, refImages: t.refImages
                    }));
                    localStorage.setItem('ai_active_tasks', JSON.stringify(tasksToSave));
                },

                // 核心生成逻辑
                async generateTasks() {
                    if(!this.prompt.trim()) return this.showToast('请输入描述', 'warning');
                    this.showToast(\`已提交 \${this.count} 个生成任务\`, 'success');
                    if(window.innerWidth <= 1024) this.currentTab = 'gallery';
                    
                    const refImagesBase64 = await Promise.all(this.refFiles.map(r => this.getBase64(r.file)));
                    
                    for(let i=0; i<this.count; i++) {
                        const taskId = 't_' + Date.now() + '_' + i;
                        const task = { 
                            id: taskId, status: 'pending', progress: 0, 
                            prompt: this.prompt, ratio: this.ratio, 
                            refCount: this.refFiles.length, refImages: refImagesBase64 
                        };
                        this.activeTasks.unshift(task);
                        this.saveTasks();
                        this.startWorkerTask(task);
                    }
                },

                async startWorkerTask(task) {
                    const finalPrompt = task.prompt + task.ratio;
                    
                    const progInt = setInterval(() => {
                        const t = this.activeTasks.find(x => x.id === task.id);
                        if(t && t.status === 'pending') {
                            t.progress = Math.min(t.progress + Math.random()*8, 95);
                            this.saveTasks();
                        }
                    }, 800);

                    try {
                        let res;
                        if(task.refImages && task.refImages.length > 0) {
                            const fd = new FormData(); 
                            fd.append('prompt', finalPrompt);
                            for (const b64 of task.refImages) {
                                const blob = await this.base64ToBlob(b64);
                                fd.append('image', blob, 'ref.png');
                            }
                            res = await fetch('/api/edit', { method: 'POST', body: fd });
                        } else {
                            res = await fetch('/api/generate', { 
                                method: 'POST', 
                                headers: {'Content-Type':'application/json'}, 
                                body: JSON.stringify({prompt: finalPrompt}) 
                            });
                        }
                        
                        if(!res.ok) throw new Error(await res.text());
                        const data = await res.json();
                        const b64 = 'data:image/png;base64,' + data.data[0].b64_json;
                        const dim = await this.getImgDim(b64);
                        
                        clearInterval(progInt);
                        this.removeTask(task.id);
                        this.saveToDB(task, b64, dim);
                        this.haptic('success');
                    } catch(err) {
                        clearInterval(progInt);
                        const t = this.activeTasks.find(x => x.id === task.id);
                        if(t) {
                            t.status = 'error'; 
                            t.errMsg = (err.message.includes("policy") ? "违规内容拦截" : "请求失败");
                            this.saveTasks();
                            this.haptic('error');
                        }
                    }
                },

                retryTask(task) {
                    task.status = 'pending';
                    task.progress = 0;
                    task.errMsg = '';
                    this.saveTasks();
                    this.startWorkerTask(task);
                },

                removeTask(id) { 
                    this.activeTasks = this.activeTasks.filter(t => t.id !== id); 
                    this.saveTasks();
                },

                getImgDim(b64) {
                    return new Promise(res => {
                        const img = new Image();
                        img.onload = () => res(\`\${img.naturalWidth}x\${img.naturalHeight}\`);
                        img.onerror = () => res('未知');
                        img.src = b64;
                    });
                },

                // DB Actions
                fetchGallery() {
                    if(!db) {
                        console.warn('Database not initialized, gallery will be empty');
                        this.gallery = [];
                        return;
                    }
                    
                    // 再次验证对象存储是否存在
                    if (!db.objectStoreNames.contains('images')) {
                        console.error('Object store "images" does not exist in database');
                        this.showToast('数据库异常，请刷新页面重试', 'error');
                        this.gallery = [];
                        return;
                    }
                    
                    try {
                        const tx = db.transaction('images', 'readonly');
                        const store = tx.objectStore('images');
                        const req = store.index('timestamp').openCursor(null, 'prev');
                        const res =[];
                        req.onsuccess = e => {
                            const cursor = e.target.result;
                            if(cursor) { res.push({id: cursor.primaryKey, ...cursor.value}); cursor.continue(); }
                            else { 
                                this.gallery = res; 
                                if(this.visibleCount < 30) this.visibleCount = 30;
                                console.log('Gallery loaded:', res.length, 'items');
                            }
                        };
                        req.onerror = (e) => {
                            console.error('Failed to fetch gallery:', e);
                            this.showToast('加载画廊失败', 'error');
                        };
                    } catch (err) {
                        console.error('Error in fetchGallery:', err);
                        this.showToast('数据库访问错误', 'error');
                        this.gallery = [];
                    }
                },
                saveToDB(task, b64, dim) {
                    if(!db) return;
                    const item = { timestamp: Date.now(), base64: b64, prompt: task.prompt, ratio: task.ratio, refCount: task.refCount, dimensions: dim, isFavorite: false };
                    const tx = db.transaction('images', 'readwrite');
                    tx.objectStore('images').add(item);
                    tx.oncomplete = () => this.fetchGallery();
                },
                toggleFav(item) {
                    if(!db) return;
                    const tx = db.transaction('images', 'readwrite');
                    const store = tx.objectStore('images');
                    const req = store.get(item.id);
                    req.onsuccess = () => {
                        const data = req.result;
                        data.isFavorite = !data.isFavorite;
                        store.put(data);
                        this.showToast(data.isFavorite ? '已加入收藏' : '已取消收藏', 'success');
                        this.fetchGallery();
                    };
                },
                deleteItem(id) {
                    this.confirmReq('删除确认', '确实要删除这张精美的作品吗？', () => {
                        if(!db) return;
                        db.transaction('images', 'readwrite').objectStore('images').delete(id).onsuccess = () => this.fetchGallery();
                    });
                },
                clearUnfav() {
                    this.confirmReq('清空图库', '将清空所有未收藏记录，确定吗？', () => {
                        if(!db) return;
                        const tx = db.transaction('images', 'readwrite');
                        const store = tx.objectStore('images');
                        store.openCursor().onsuccess = e => {
                            const c = e.target.result;
                            if(c) { if(!c.value.isFavorite) store.delete(c.primaryKey); c.continue(); }
                        };
                        tx.oncomplete = () => { this.showToast('已清空', 'success'); this.fetchGallery(); };
                    });
                },

                // 虚拟列表与过滤
                get filteredGallery() {
                    return this.gallery.filter(i => {
                        if(this.filterFav && !i.isFavorite) return false;
                        if(this.filterRatio !== 'all' && !(i.ratio||'').includes(this.filterRatio)) return false;
                        return true;
                    });
                },
                get visibleGallery() {
                    return this.filteredGallery.slice(0, this.visibleCount);
                },
                loadMore() {
                    if (this.visibleCount < this.filteredGallery.length) {
                        this.visibleCount += 30;
                    }
                },

                // Card Actions
                copyP(txt, btn) {
                    navigator.clipboard.writeText(txt).then(()=>{
                        const orig = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-check"></i>'; btn.classList.add('text-emerald-500');
                        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('text-emerald-500'); }, 1500);
                        this.showToast('提示词已复制', 'success');
                    });
                },
                useAsRef(item) {
                    this.prompt = item.prompt;
                    this.ratio = item.ratio || '';
                    fetch(item.base64).then(res => res.blob()).then(blob => {
                        const f = new File([blob], 'ref.png', {type: blob.type});
                        this.refFiles = [{file: f, url: URL.createObjectURL(f)}];
                        this.showToast('已载入垫图面板', 'success');
                        this.currentTab = 'create';
                        window.scrollTo(0,0);
                    });
                },

                // Batch
                batchDelete() {
                    if(this.selectedItems.length===0) return this.showToast('请选择图片','warning');
                    this.confirmReq('批量删除', \`确定删除 \${this.selectedItems.length} 张图吗？\`, () => {
                        if(!db) return;
                        const tx = db.transaction('images', 'readwrite');
                        this.selectedItems.forEach(id => tx.objectStore('images').delete(Number(id)));
                        tx.oncomplete = () => { this.isBatch=false; this.selectedItems=[]; this.fetchGallery(); };
                    });
                },
                async batchDownload() {
                    if(this.selectedItems.length===0) return this.showToast('请选择图片','warning');
                    this.showToast('打包中...','info');
                    const zip = new JSZip();
                    this.selectedItems.forEach((id, i) => {
                        const it = this.gallery.find(x=>x.id==id);
                        if(it) zip.folder("AI_Exports").file(\`\${i+1}_\${it.prompt.substring(0,10)}.png\`, it.base64.split(',')[1], {base64: true});
                    });
                    const content = await zip.generateAsync({type:"blob"});
                    const a = document.createElement('a'); a.href = URL.createObjectURL(content); a.download = 'AI_Batch.zip'; a.click();
                    this.isBatch=false; this.selectedItems=[];
                },

                // Lightbox
                openLb(item) { this.lb = { open: true, item, scale: 1, x: 0, y: 0 }; },
                lbDownload() { const a=document.createElement('a'); a.href=this.lb.item.base64; a.download='AI.png'; a.click(); },
                lbContinue() { this.lb.open=false; this.useAsRef(this.lb.item); },
                lbWheel(e) { this.lb.scale = Math.max(0.5, Math.min(3, this.lb.scale + (e.deltaY<0?0.1:-0.1))); },
                lbDragStart(e) { if(this.lb.scale>1){ this.dragInfo.isDragging=true; this.dragInfo.startX=e.clientX-this.lb.x; this.dragInfo.startY=e.clientY-this.lb.y;} },
                lbDragMove(e) { if(this.dragInfo.isDragging){ this.lb.x=e.clientX-this.dragInfo.startX; this.lb.y=e.clientY-this.dragInfo.startY;} },
                lbDragEnd() { this.dragInfo.isDragging=false; },

                // 复制 API Key
                copyApiKey() {
                    navigator.clipboard.writeText('${API_KEYS[0]}').then(() => {
                        this.showToast('API Key 已复制到剪贴板', 'success');
                        this.haptic('success');
                    }).catch(() => {
                        this.showToast('复制失败，请手动复制', 'error');
                    });
                },

                // 复制微信号
                copyWechat() {
                    navigator.clipboard.writeText('Tf00798').then(() => {
                        this.showToast('微信号已复制到剪贴板', 'success');
                        this.haptic('success');
                    }).catch(() => {
                        this.showToast('复制失败，请手动复制', 'error');
                    });
                }
            }));
        });
    </script>
</body>
</html>
`;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "GET" && url.pathname === "/") {
            return new Response(HTML_CONTENT, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
        }

        const executeFetchWithRetry = async (endpoint, options) => {
            const maxRetries = 2;
            let lastError;
            
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const randomKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
                    const headers = new Headers(options.headers || {});
                    headers.set('Authorization', `Bearer ${randomKey}`);
                    
                    const upstreamResponse = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
                    if (upstreamResponse.status === 429 || upstreamResponse.status >= 500) {
                        throw new Error(`Upstream Error: ${await upstreamResponse.text()}`);
                    }
                    return new Response(JSON.stringify(await upstreamResponse.json()), {
                        status: upstreamResponse.status,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (err) {
                    lastError = err;
                    if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000));
                }
            }
            return new Response(JSON.stringify({ error: { message: `Gateway failed: ${lastError.message}` } }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        };

        if (request.method === "POST" && url.pathname === "/api/generate") {
            try {
                const body = await request.json();
                return await executeFetchWithRetry('/v1/images/generations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: MODEL_NAME, prompt: body.prompt, response_format: "b64_json", n: 1 })
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: { message: err.message } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (request.method === "POST" && url.pathname === "/api/edit") {
            try {
                const clientFormData = await request.formData();
                const upstreamFormData = new FormData();
                upstreamFormData.append("model", MODEL_NAME);
                upstreamFormData.append("response_format", "b64_json");
                upstreamFormData.append("n", "1");
                upstreamFormData.append("prompt", clientFormData.get("prompt") || "修改图像");
                for (const value of clientFormData.getAll('image')) upstreamFormData.append('image', value);

                return await executeFetchWithRetry('/v1/images/edits', { method: 'POST', body: upstreamFormData });
            } catch (err) {
                return new Response(JSON.stringify({ error: { message: err.message } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
};
