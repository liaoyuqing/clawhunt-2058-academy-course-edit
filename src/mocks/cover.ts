/**
 * 内置的 16:9 封面占位图（data URL，SVG）。
 *
 * 用 data URL 而不是外部图片地址，原因有两个：
 * 1. 订单约束禁止任何向境外发数据的第三方资源，页面里不能出现外链图片；
 * 2. 截图与离线演示需要封面真实可见，指向不存在的相对路径会渲染成破图。
 */
const COVER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">',
  '<defs>',
  '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
  '<stop offset="0%" stop-color="#e8f0fe"/>',
  '<stop offset="55%" stop-color="#dfe7f5"/>',
  '<stop offset="100%" stop-color="#eef2f9"/>',
  '</linearGradient>',
  '<linearGradient id="bar" x1="0" y1="1" x2="1" y2="0">',
  '<stop offset="0%" stop-color="#0052d9"/>',
  '<stop offset="100%" stop-color="#4b8bf5"/>',
  '</linearGradient>',
  '</defs>',
  '<rect width="1280" height="720" fill="url(#bg)"/>',
  '<g fill="url(#bar)" opacity="0.92">',
  '<rect x="120" y="360" width="96" height="180" rx="10"/>',
  '<rect x="248" y="300" width="96" height="240" rx="10"/>',
  '<rect x="376" y="228" width="96" height="312" rx="10"/>',
  '<rect x="504" y="156" width="96" height="384" rx="10"/>',
  '</g>',
  '<g fill="none" stroke="#0052d9" stroke-width="10" stroke-linecap="round" opacity="0.75">',
  '<path d="M168 330 L296 268 L424 196 L552 132"/>',
  '</g>',
  '<g fill="#0052d9">',
  '<circle cx="168" cy="330" r="15"/>',
  '<circle cx="296" cy="268" r="15"/>',
  '<circle cx="424" cy="196" r="15"/>',
  '<circle cx="552" cy="132" r="15"/>',
  '</g>',
  '<text x="700" y="308" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="62" font-weight="700" fill="#1a1f2b">会员增长实战</text>',
  '<text x="700" y="382" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="34" fill="#4b5563">从拉新到留存的六个动作</text>',
  '<rect x="700" y="424" width="196" height="8" rx="4" fill="#0052d9" opacity="0.35"/>',
  '<text x="700" y="500" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="26" fill="#8b95a5">工作台学院 · 增长与运营</text>',
  '</svg>',
].join('');

/** 封面 data URL，可直接放进 <img src> */
export const COVER_DATA_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(COVER_SVG);
